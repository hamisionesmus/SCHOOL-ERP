import { AuthenticationCreds, AuthenticationState, BufferJSON, SignalDataTypeMap, initAuthCreds, proto } from '@whiskeysockets/baileys';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

/**
 * Adapts Baileys' own reference filesystem implementation (useMultiFileAuthState, see that file's
 * doc comment: "I wouldn't endorse this for any production level use... would recommend writing an
 * auth state for use with a proper SQL DB") onto Postgres instead — same keyId→JSON-blob shape,
 * just persisted in PlatformWhatsAppAuthKey rather than one file per key. This is what lets the
 * linked-device session survive a container rebuild/redeploy without a mounted volume: the whole
 * point of this being DB-backed rather than filesystem-backed, since this codebase's CI/CD rebuilds
 * the api container on every push to main.
 */
export async function useDbAuthState(platformPrisma: PlatformPrismaService): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAll: () => Promise<void>;
}> {
  const writeData = async (key: string, data: unknown) => {
    const json = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    await platformPrisma.platformWhatsAppAuthKey.upsert({
      where: { keyId: key },
      create: { keyId: key, data: json },
      update: { data: json },
    });
  };

  const readData = async <T = unknown>(key: string): Promise<T | null> => {
    const row = await platformPrisma.platformWhatsAppAuthKey.findUnique({ where: { keyId: key } });
    if (!row) return null;
    return JSON.parse(JSON.stringify(row.data), BufferJSON.reviver) as T;
  };

  const removeData = async (key: string) => {
    await platformPrisma.platformWhatsAppAuthKey.delete({ where: { keyId: key } }).catch(() => undefined);
  };

  const creds = (await readData<AuthenticationCreds>('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value !== null) data[id] = value as SignalDataTypeMap[T];
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category as keyof typeof data]) {
              const value = data[category as keyof typeof data]?.[id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    // Called on an explicit "Disconnect" — wipes every stored signal key so a fresh Connect always
    // starts a genuinely new pairing (a stale partial session left behind would otherwise confuse
    // the next QR-code linking attempt).
    clearAll: async () => {
      await platformPrisma.platformWhatsAppAuthKey.deleteMany({});
    },
  };
}

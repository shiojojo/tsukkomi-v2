import { useMemo } from 'react';
import type { User } from '~/lib/schemas/user';

export function useNameByProfileId(users: User[]) {
  const nameByProfileId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users) {
      map[String(user.id)] = user.name;
      for (const sub of user.subUsers ?? []) {
        map[String(sub.id)] = sub.name;
      }
    }
    return map;
  }, [users]);

  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    return nameByProfileId[String(pid)];
  };

  return { nameByProfileId, getNameByProfileId };
}
// Each user can have optional subUsers which represent "role-like" alternate identities
// that can be used to perform actions such as voting. IDs for subUsers are namespaced
// under the parent user id using a simple separator (e.g. user-1#sub-1) in this mock.
export const mockUsers = [
  {
    id: 'user-1',
    name: 'Alice',
    subUsers: [
      { id: 'user-1#sub-1', name: 'Alice (bot)' },
      { id: 'user-1#sub-2', name: 'Alice (alt)' },
    ],
  },
  {
    id: 'user-2',
    name: 'Bob',
    subUsers: [
      { id: 'user-2#sub-1', name: 'Bob (alt)' },
    ],
  },
];

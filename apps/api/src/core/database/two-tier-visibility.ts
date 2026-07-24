export function visibleToUser(userId: string): {
  OR: [{ userId: null }, { userId: string }];
} {
  return { OR: [{ userId: null }, { userId }] };
}

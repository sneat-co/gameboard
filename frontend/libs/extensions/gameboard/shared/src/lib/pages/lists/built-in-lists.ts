import { SpaceType } from '@sneat/core';
import { IListGroup } from '@sneat/extension-gameboard-contract';

// Built-in default list groups shown for a space, for instant UX before/alongside
// the lists persisted on the space DBO. Personal (private) and family spaces both
// get To Buy / To Do; other space types have no built-ins. Shared by the lists
// page and the template space menu so they stay consistent.
export function builtInListGroups(spaceType?: SpaceType): IListGroup[] {
  if (spaceType !== 'family' && spaceType !== 'private') {
    return [];
  }
  return [
    {
      id: 'buy',
      type: 'buy',
      title: 'To Buy',
      lists: [
        { id: 'groceries', type: 'buy', emoji: '🛒', title: 'Groceries' },
        { id: 'wholesale', type: 'buy', emoji: '🛒', title: 'Wholesale' },
      ],
    },
    {
      id: 'to-do',
      type: 'do',
      title: 'To Do',
      lists: [{ id: 'chores', type: 'do', emoji: '🧹', title: 'Chores' }],
    },
  ];
}

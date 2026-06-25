import { InjectionToken } from '@angular/core';
import { ISpaceContext } from '@sneat/space-models';
import { Observable } from 'rxjs';
import { IListContext } from '../contexts';
import { ListType } from '../dto';
import {
  ICreateListRequest,
  IDeleteListItemsRequest,
  IListItemResult,
  IListItemsCommandParams,
  IReorderListItemsRequest,
  ISetListItemsIsComplete,
} from './interfaces';

// IGameboardService is the runtime-light contract the template pages and components
// depend on. Members mirror the concrete ListService public surface used by the
// UI; the implementation lives in the internal lib and is provided via the
// GAMEBOARD_SERVICE token below. The shared BaseListPage additionally needs the
// inherited ModuleSpaceItemService surface, so it types the injected token as
// an intersection with ModuleSpaceItemService<IListBrief, IListDbo>.
export interface IGameboardService {
  createList(request: ICreateListRequest): Observable<IListContext>;
  deleteList(space: ISpaceContext, listId: string): Observable<void>;
  reorderListItems(request: IReorderListItemsRequest): Observable<void>;
  createListItems(
    params: IListItemsCommandParams,
  ): Observable<IListItemResult>;
  setListItemsIsCompleted(
    request: ISetListItemsIsComplete,
  ): Observable<void>;
  deleteListItems(request: IDeleteListItemsRequest): Observable<void>;
  getListById(
    space: ISpaceContext,
    listType: ListType,
    listID: string,
  ): Observable<IListContext>;
}

export const GAMEBOARD_SERVICE = new InjectionToken<IGameboardService>(
  'GameboardService',
);

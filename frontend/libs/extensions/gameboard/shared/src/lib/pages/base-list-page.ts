import { signal } from '@angular/core';
import { ParamMap } from '@angular/router';
import { emptyTimestamp } from '@sneat/dto';
import { SpaceItemPageBaseComponent } from '@sneat/space-components';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IListBrief,
  IListContext,
  IListDbo,
  ListType,
} from '@sneat/extension-gameboard-contract';
import { GameboardComponentBaseParams } from '../gameboard-component-base-params';

export abstract class BaseListPage extends SpaceItemPageBaseComponent<
  IListBrief,
  IListDbo
> {
  protected readonly $list = signal<IListContext | undefined>(undefined);
  protected readonly $listGroupTitle = signal<string | undefined>(undefined);
  protected readonly $listType = signal<ListType | undefined>(undefined);
  protected listID?: string;

  protected get list(): IListContext | undefined {
    return this.$list();
  }

  protected constructor(
    // defaultBackPage: DefaultBackPage,
    protected readonly params: GameboardComponentBaseParams,
  ) {
    super('lists', 'list', params.listService);
  }

  protected override setItemContext(item: IListContext): void {
    if (item && !item?.type) {
      item = { ...item, type: item.id.split('!')[0] as ListType };
    }
    super.setItemContext(item);
    if (item) {
      this.setList(item);
    }
  }

  protected override briefs():
    | Readonly<Record<string, IListBrief>>
    | undefined {
    return {}; // TODO: implement
  }

  protected get listService() {
    return this.params.listService;
  }

  protected setList(list: IListContext): void {
    const current = this.list;
    if (!list.brief && list.id == current?.id && current.brief) {
      list = { ...list, brief: current.brief };
    }
    this.$list.set(list);
  }

  override getItemID$(paramMap$: Observable<ParamMap>): Observable<string> {
    return paramMap$.pipe(
      map((params) => {
        this.listID = params.get('listID') || undefined;
        const listType = params.get('listType') as ListType;
        this.$listType.set(listType);

        if (this.listID && listType) {
          const title =
            this.listID.charAt(0).toUpperCase() + this.listID.slice(1);
          this.setList({
            id: this.listID,
            type: listType,
            brief: {
              createdAt: emptyTimestamp,
              createdBy: '',
              type: listType,
              title,
            },
            space: this.space,
          });
        }

        return `${listType}!${this.listID}`;
      }),
    );
  }
}

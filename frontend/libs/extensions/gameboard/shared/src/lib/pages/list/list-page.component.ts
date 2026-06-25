import { NgOptimizedImage } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { ContactusServicesModule } from '@sneat/extension-contactus-internal';
import { SharedWithComponent } from '@sneat/extension-contactus-shared';
import { RandomIdService } from '@sneat/random';
import { SpaceServiceModule } from '@sneat/space-services';
import { ClassName } from '@sneat/ui';
import { GameboardCoreServicesModule } from '../../services';
import { SpaceComponentBaseParams } from '@sneat/space-components';
import {
  IListContext,
  IListItemBrief,
  IDeleteListItemsRequest,
  IReorderListItemsRequest,
  ISetListItemsIsComplete,
} from '@sneat/extension-gameboard-contract';
import { takeUntil } from 'rxjs';
import { GameboardComponentBaseParams } from '../../gameboard-component-base-params';
import { IGameboardAppStateService } from '../../services';
import { BaseListPage } from '../base-list-page';
import { ListDialogsService } from '../dialogs/ListDialogs.service';
import { IListItemWithUiState } from './list-item-with-ui-state';
import { ListItemComponent } from './list-item/list-item.component';
import { NewListItemComponent } from './new-list-item/new-list-item.component';

type ListPageSegment = 'list' | 'cards' | 'recipes' | 'settings' | 'discover';
type ListPagePerforming =
  | 'reactivating completed'
  | 'deleting completed'
  | 'clear list';

@Component({
  selector: 'gameboard-list',
  templateUrl: './list-page.component.html',
  imports: [
    GameboardCoreServicesModule,
    NgOptimizedImage,
    ContactusServicesModule,
    ListItemComponent,
    NewListItemComponent,
    SpaceServiceModule,
    SharedWithComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonButton,
    IonIcon,
    IonContent,
    IonCard,
    IonSegment,
    IonSegmentButton,
    FormsModule,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonList,
    IonReorderGroup,
    IonCardContent,
    IonText,
    IonCol,
    IonRow,
    IonGrid,
    IonReorder,
    IonSpinner,
    IonFooter,
  ],
  styleUrls: ['./list-page.component.scss'],
  providers: [
    { provide: ClassName, useValue: 'ListPageComponent' },
    SpaceComponentBaseParams,
    GameboardComponentBaseParams,
    ListDialogsService,
    RandomIdService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPageComponent extends BaseListPage implements AfterViewInit {
  private readonly listDialogs = inject(ListDialogsService);
  private readonly gameboardAppStateService = inject(IGameboardAppStateService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  protected readonly isPersisting = signal(false);
  protected readonly isHideWatched = signal(false);
  protected readonly isReordering = signal(false);

  protected readonly listMode = signal<'reorder' | 'swipe'>('swipe');
  protected readonly doneFilter = signal<
    'all' | 'active' | 'completed' | undefined
  >(undefined);
  protected readonly segment = signal<ListPageSegment>('list');
  protected readonly allListItems = signal<
    IListItemWithUiState[] | undefined
  >(undefined);
  protected readonly listItems = signal<IListItemWithUiState[] | undefined>(
    undefined,
  );
  protected readonly newListItem =
    viewChild<NewListItemComponent>('newListItem');
  protected addingItems: IListItemWithUiState[] = [];
  protected readonly performing = signal<ListPagePerforming | undefined>(
    undefined,
  );

  // protected completedListItems?: IListItemWithUiState[];
  // protected activeListItems?: IListItemWithUiState[];

  constructor() {
    const params = inject(GameboardComponentBaseParams);

    super(params);
    const gameboardAppStateService = this.gameboardAppStateService;
    this.preloader.markAsPreloaded('list');
    if (location.pathname.includes('/lists')) {
      // TODO: document why & how it is possible
      return;
    }
    gameboardAppStateService.changed.subscribe((appState) => {
      this.isHideWatched.set(!appState.showWatched);
    });
  }

  ngAfterViewInit(): void /* Intentionally not ngOnInit */ {
    const newListItem = this.newListItem();
    if (newListItem) {
      newListItem.adding.subscribe((item: IListItemWithUiState) => {
        this.addingItems.push(item);
        this.applyFilter();
      });
      newListItem.added.subscribe((item: IListItemWithUiState) => {
        this.addingItems = this.addingItems.filter(
          (v) => v.brief.id !== item.brief.id,
        );
        this.applyFilter();
      });

      newListItem.failedToAdd.subscribe((id: string): void => {
        this.addingItems = this.addingItems.filter((v) => v.brief.id !== id);
      });
    } else {
      this.errorLogger.logError('newListItem component is not initialized');
    }
  }

  public setEditMode(e: Event, v: 'reorder' | 'swipe'): boolean {
    e.preventDefault();
    e.stopPropagation();
    this.listMode.set(v);
    return false;
  }

  public clickShowWatchedMovies(): void {
    this.gameboardAppStateService.setShowWatched(this.isHideWatched());
  }

  // ngOnInit(): void {
  // 	super.ngOnInit();
  // 	const { pathname } = location;
  // 	if (pathname.includes('/lists')) {
  // 		return;
  // 	}
  // 	if (pathname.includes('/recipes')) {
  // 		this.segment = 'cards';
  // 		this.listType = 'recipe';
  // 	} else if (pathname.includes('/watch')) {
  // 		this.segment = 'cards';
  // 		this.listType = 'watch';
  // 	}
  // 	this.preloader.preload(['lists']);
  // }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onIsDoneFilterChanged(_event: Event): void {
    this.applyFilter();
  }

  protected override setList(list: IListContext): void {
    if (this.isReordering()) {
      return;
    }
    super.setList(list);
    let allListItems: IListItemWithUiState[] | undefined =
      list.dbo === undefined
        ? undefined
        : list.dbo?.items
          ? list.dbo.items.map((item) => {
              return { brief: item, state: {} };
            })
          : [];
    if (allListItems && this.addingItems.length) {
      this.addingItems = this.addingItems.filter(
        (v) => !this.listItems()?.some((li) => li.brief.id === v.brief.id),
      );
      if (this.addingItems.length) {
        allListItems = [...allListItems, ...this.addingItems];
      }
    }
    this.allListItems.set(allListItems);
    this.applyFilter();
  }

  // protected isWatched(movie: IMovie, userId: string): boolean {
  // 	console.log(movie, 'userId', userId);
  // 	console.warn('isWatched is not implemented yet');
  // 	return false;
  // 	//return this.templateDbService.isWatched(movie, userId);
  // }

  protected removeIsWatchedFromWatchlist(): void {
    this.errorLogger.logError(
      'removeIsWatchedFromWatchlist is not implemented yet',
    );
    // 	console.log('remove');
    // 	movies.forEach(movie => {
    // 		// console.log(movie.watchedByUserIds);
    // 		if (this.isWatched(movie, this.userId)) {
    // 			console.log('remove movie');
    // 			this.templateService.deleteListItem(this.createListItemCommandParams(movie))
    // 				.subscribe(
    // 					listDto => {
    // 						this.setList(listDto);
    // 					},
    // 					this.errorLogger.logError,
    // 				);
    // 		}
    // 	});
  }

  protected itemChanged(changedItem: {
    old: IListItemWithUiState;
    new: IListItemWithUiState;
  }): void {
    const allListItems = this.allListItems();
    if (allListItems) {
      const itemIndex = allListItems.findIndex(
        (item) => item === changedItem.old,
      );
      if (itemIndex >= 0) {
        const updated = [...allListItems];
        updated[itemIndex] = changedItem.new;
        this.allListItems.set(updated);
        this.applyFilter();
      }
    }
  }

  protected goListItem(item: IListItemBrief): void {
    if (!this.space) {
      return;
    }
    if (item.subListId) {
      const path = item.subListType === 'recipes' ? 'recipe' : 'list';
      this.spaceNav
        .navigateForwardToSpacePage(this.space, path, {
          state: { list: this.list, listItem: item },
        })
        .catch(this.errorLogger.logError);
    }
  }

  protected reorder(e: Event): void {
    const event = e as CustomEvent<{
      from: number;
      to: number;
      complete: (
        list: boolean | IListItemWithUiState[],
      ) => IListItemWithUiState[];
    }>;
    const allListItems = this.allListItems();
    if (allListItems) {
      // temp mock
      let movingItem = allListItems[event.detail.from];
      movingItem = {
        ...movingItem,
        state: { ...movingItem.state, isReordering: true },
      };
      const updated = [...allListItems];
      updated[event.detail.from] = movingItem;
      this.allListItems.set(updated);
      event.detail.complete(updated);
      this.applyFilter();
      if (!this.space || !this.list?.brief) {
        return;
      }
      const request: IReorderListItemsRequest = {
        spaceID: this.space.id,
        listID: this.list.id,
        // listType: this.list.brief?.type,
        itemIDs: [movingItem.brief.id],
        toIndex: event.detail.to,
      };
      this.listService.reorderListItems(request).subscribe({
        complete: () => {
          movingItem = {
            ...movingItem,
            state: { ...movingItem.state, isReordering: true },
          };
          const current = this.allListItems();
          if (current) {
            const next = [...current];
            next[event.detail.from] = movingItem;
            this.allListItems.set(next);
          }
          this.isReordering.set(false);
        },
        error: this.errorLogger.logErrorHandler('failed to reorder list items'),
      });
      setTimeout(() => {
        if (!this.allListItems()) {
          return;
        }
      }, 1000);
    }
    console.log(
      `ListPage.reorder(from=${event.detail.from}, to=${event.detail.to})`,
    );

    // this.listService.reorderListItems(
    // 	this.createListItemCommandParams(undefined),
    // 	listDto => {
    // 		console.log('ListPage.reorder() => event.detail.complete()');
    // 		if (!listDto.items) {
    // 			throw new Error('!listDto.items');
    // 		}
    // 		event.detail.complete(listDto.items);
    // 	},
    // )
    // 	.subscribe({
    // 		next: listDto => {
    // 			this.listDto = listDto;
    // 			this.listInfo = createListInfoFromDto(listDto, this.shortListId);
    // 			if (!listDto.items) {
    // 				throw new Error('!listDto.items');
    // 			}
    // 			this.listItems = listDto.items;
    // 			console.log('ListPage.reorder() => completed');
    // 		},
    // 		error: err => {
    // 			event.detail.complete(false);
    // 			this.errorLogger.logError(err);
    // 		},
    // 	});
  }

  protected newItem(): void {
    if (!this.list) {
      throw new Error('!this.listItems');
    }
    switch (this.list?.brief?.type) {
      case 'buy':
        break;
      case 'cook':
        break;
      case 'do':
        break;
      case 'other':
        break;
      case 'recipes':
        break;
      case 'rsvp':
        break;
      case 'watch':
        this.errorLogger.logError('Not implemented yet');
        // this.teamNav.navigateForwardToSpacePage(
        // 	'list/add-to-watch',
        // 	{
        // 		list: this.listId,
        // 	},
        // 	{
        // 		listInfo: this.listInfo,
        // 		listDto: this.listDto,
        // 	},
        // 	{
        // 		excludeCommuneId: true,
        // 	},
        // );
        break;
      default:
        this.focusAddInput();
        break;
    }
  }

  protected focusAddInput(): void {
    this.newListItem()?.focus();
  }

  protected openCopyListItemsDialog(
    listItem?: IListItemBrief,
    event?: Event,
  ): void {
    if (event) {
      event.stopPropagation();
    }

    if (listItem) {
      this.errorLogger.logError('not implemented yet');
    } else if (this.list && this.listItems()) {
      this.errorLogger.logError('not implemented yet');
    }
  }

  protected deleteCompleted(): void {
    this.deleteItems(
      this.allListItems()?.filter((li) => li.brief.status === 'done'),
    );
  }

  protected deleteAll(): void {
    this.deleteItems(this.allListItems());
  }

  private deleteItems(items?: IListItemWithUiState[]): void {
    if (!this.space || !this.list?.brief || !items) {
      return;
    }
    let deletingItems: IListItemWithUiState[] = [];
    items.forEach((li) => {
      li = { ...li, state: { ...li.state, isDeleting: true } };
      deletingItems.push(li);
    });
    if (!items.length) {
      alert('Nothing to delete');
      return;
    }
    const request: IDeleteListItemsRequest = {
      spaceID: this.space.id,
      listID: this.list.id,
      // listType: this.list.brief.type,
      itemIDs: deletingItems.map((li) => li.brief.id),
    };
    this.changeDetectorRef.markForCheck();
    this.listService.deleteListItems(request).subscribe({
      error: this.errorLogger.logErrorHandler('failed to delete list items'),
      complete: () => {
        deletingItems = deletingItems.map((li) =>
          Object.assign(li, { state: { ...li.state, isDeleting: false } }),
        );
      },
    });
  }

  protected reactivateCompleted(): void {
    const allListItems = this.allListItems();
    if (!this.list?.brief || !this.space || !allListItems) {
      return;
    }
    const request: ISetListItemsIsComplete = {
      spaceID: this.space.id,
      listID: this.list.id,
      // listType: this.list.brief.type,
      isDone: false,
      itemIDs: allListItems
        .filter((li) => li.brief.status === 'done')
        .map((li) => li.brief.id),
    };
    if (!request.itemIDs.length) {
      alert('You have no completed items');
      return;
    }
    this.performing.set('reactivating completed');
    this.listService
      .setListItemsIsCompleted(request)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: () => {
          this.performing.set(undefined);
        },
        error: (err) => {
          this.performing.set(undefined);
          this.errorLogger.logError(
            err,
            'failed to reactivate all completed items',
          );
        },
      });
  }

  protected goGroceries(): void {
    if (!this.space.id) {
      this.errorLogger.logError('no space context');
      return;
    }
    this.errorLogger.logError('not implemented yet');
    // this.spaceNav.navigateForwardToSpacePage(this.team,
    // 	`list/${this.list?.id}`, {
    // 		state: { list: this.list },
    // 	});
  }

  private applyFilter(): void {
    const allListItems = this.allListItems();
    const doneFilter = this.doneFilter();
    if (!doneFilter) {
      if (
        !allListItems?.length ||
        allListItems?.some((li) => li.brief.status !== 'done')
      ) {
        this.doneFilter.set('active');
      } else {
        this.doneFilter.set('all');
      }
    }
    const filtered =
      allListItems?.filter(
        (li) =>
          doneFilter === 'all' ||
          (doneFilter === 'completed' && li.brief.status === 'done') ||
          (doneFilter === 'active' && li.brief.status !== 'done'),
      ) || [];
    this.listItems.set([...filtered, ...this.addingItems]);
  }

  // protected onListInfoChanged(): void {
  // 	super.onListInfoChanged();
  // 	if (this.listInfo) {
  // 		if (this.listInfo.id) {
  // 			if (!this.listItems && this.listInfo.itemsCount) {
  // 				this.listItems = [];
  // 				for (let i = 0; i < this.listInfo.itemsCount; i += 1) {
  // 					this.listItems.push(undefined);
  // 				}
  // 			}
  // 			const list$ = this.shelfService.pop('list$') as Observable<IListDto>;
  // 			console.log('list$:', list$);
  // 			if (list$) {
  // 				this.processList$(this.listInfo.id, list$);
  // 			} else {
  // 				this.subscribeForListChanges(this.listInfo.id);
  // 			}
  // 		} else {
  // 			this.shortListId = this.listInfo.shortId;
  // 			if (this.shortCommuneInfo && !this.listInfo.id) {
  // 				this.createVirtualListItems(this.shortCommuneInfo);
  // 			}
  // 		}
  // 	}
  // }

  // protected setDefaultBackUrl(page?: DefaultBackPage, params?: { member?: string }): void {
  // 	if (this.appService.appId === 'gameboard') {
  // 		this.defaultBackUrl = CommuneTopPage.lists;
  // 	} else {
  // 		super.setDefaultBackUrl(page, params);
  // 	}
  // }

  // private createVirtualListItems(communeShortInfo: IShortCommuneInfo): void {
  // 	console.log('ListPage.createVirtualListItems()', communeShortInfo);
  // 	if (!this.shortListId) {
  // 		throw new Error('!this.shortListId');
  // 	}
  // 	const listDto = this.virtualRecords.createVirtualListDto(this.shortListId, communeShortInfo);
  // 	this.setList(listDto);
  // }

  // private createListItemCommandParams(item?: IListItemInfo): IListItemsCommandParams {
  // 	if (!this.listDto) {
  // 		throw new Error(`Page have no list DTO object, shortId=${this.shortListId}`);
  // 	}
  // 	if (!this.commune) {
  // 		throw new Error('!this.commune');
  // 	}
  // 	return {
  // 		commune: this.commune,
  // 		list: { dto: this.listDto, shortId: this.shortListId },
  // 		items: item ? [item] : [],
  // 	};
  // }
}

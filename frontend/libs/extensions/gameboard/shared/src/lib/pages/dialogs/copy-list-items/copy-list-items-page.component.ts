import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import {
  ModalController,
  ToastController,
  IonButton,
  IonCheckbox,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  IListInfo,
  IListItemBrief,
  IGameboardService,
  GAMEBOARD_SERVICE,
  ListType,
} from '@sneat/extension-gameboard-contract';
import { ErrorLogger, IErrorLogger } from '@sneat/core';

@Component({
  selector: 'gameboard-copy-list-items',
  templateUrl: './copy-list-items-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonFooter,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
  ],
})
export class CopyListItemsPageComponent implements OnInit {
  private readonly errorLogger = inject<IErrorLogger>(ErrorLogger);
  private readonly toastCrl = inject(ToastController);
  private readonly listService = inject<IGameboardService>(GAMEBOARD_SERVICE);

  @Input() modal?: ModalController;
  @Input() from?: IListInfo;
  @Input() to?: IListInfo;

  protected readonly $listItems = signal<IListItemBrief[] | undefined>(
    undefined,
  );
  @Input()
  set listItems(value: IListItemBrief[] | undefined) {
    this.$listItems.set(value);
  }
  get listItems(): IListItemBrief[] | undefined {
    return this.$listItems();
  }

  private selectedListItemIds: string[] = [];

  ngOnInit(): void {
    if (!this.listItems) {
      this.loadList();
    } else {
      this.setSelected();
    }
  }

  cancel(): void {
    this.modal?.dismiss().catch(this.errorLogger.logError);
  }

  addSelected(): void {
    // this.userService.currentUserLoaded.pipe(
    // 	first(),
    // 	mergeMap(
    // 		userDto => {
    // 			if (!userDto) {
    // 				throw new Error('!userDto');
    // 			}
    // 			if (!this.to?.team) {
    // 				throw new Error('!this.to.team');
    // 			}
    // 			if (!this.from?.team) {
    // 				throw new Error('!this.from.team');
    // 			}
    // 			if (!this.listItems) {
    // 				throw new Error('!this.listItems');
    // 			}
    // 			const toListId = this.to.id || `${this.to.team.id}-${this.to.shortId}`;
    // 			const listItemsToAdd = this.listItems.filter(
    // 				item => this.selectedListItemIds.some(id => id === item.id));
    // 			return this.templateService.copyListItems(this.from.id, toListId, listItemsToAdd, userDto);
    // 		},
    // 	),
    // 	ignoreElements(),
    // )
    // 	.subscribe(
    // 		{
    // 			complete: () => {
    // 				console.log('Selected items added to target list');
    // 				this.addSelectedCompleted()
    // 					.catch(this.errorLogger.logError);
    // 			},
    // 			error: this.errorLogger.logError,
    // 		},
    // 	);
  }

  onItemToggled(event: Event): void {
    const { checked, value } = (event as CustomEvent).detail as {
      checked: boolean;
      value: string;
    };
    if (checked) {
      if (!this.selectedListItemIds.includes(value)) {
        this.selectedListItemIds.push(value);
      }
    } else {
      this.selectedListItemIds = this.selectedListItemIds.filter(
        (v) => v !== value,
      );
    }
  }

  private loadList(): void {
    if (this.from?.id) {
      this.listService
        .getListById(
          { id: 'TO_BE_IMPLEMENTED' },
          'TO_BE_IMPLEMENTED' as ListType,
          this.from.id,
        )
        .subscribe({
          next: (list) => {
            this.listItems = (list && list.dbo?.items) || [];
            this.setSelected();
          },
          error: this.errorLogger.logError,
        });
    }
  }

  private setSelected(): void {
    this.selectedListItemIds = this.listItems
      ? this.listItems.map((item) => item.id as string)
      : [];
  }

  private async addSelectedCompleted(): Promise<void> {
    const toast = await this.toastCrl.create({
      message: `${this.selectedListItemIds.length} items copied`,
    });
    toast.present().catch(this.errorLogger.logError);
    await this.modal?.dismiss();
  }
}

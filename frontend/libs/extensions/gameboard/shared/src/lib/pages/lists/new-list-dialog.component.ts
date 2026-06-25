import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonRow,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { IListInfo, ListType } from '@sneat/extension-gameboard-contract';
import { ErrorLogger, IErrorLogger } from '@sneat/core';

@Component({
  selector: 'gameboard-new-list-popover',
  templateUrl: 'new-list-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    FormsModule,
    IonTitle,
    IonToolbar,
    IonRadioGroup,
    IonRadio,
    IonLabel,
    IonFooter,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
  ],
})
export class NewListDialogComponent implements AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly errorLogger = inject<IErrorLogger>(ErrorLogger);

  protected readonly listNameInput = viewChild<IonInput>('listNameInput');

  public readonly listName = signal('');
  public readonly visibility = signal<'private' | 'family'>('private');

  @Input() title?: string;
  @Input() listType?: ListType;
  @Input() modal?: ModalController;

  ngAfterViewInit(): void /* Intentionally not ngOnInit */ {
    setTimeout(() => {
      void this.listNameInput()
        ?.setFocus?.()
        ?.catch(this.errorLogger.logError);
    }, 250);
  }

  createList(): void {
    if (!this.listType) {
      this.errorLogger.logError('list type is not set');
      return;
    }
    const visibility = this.visibility();
    const listInfo: IListInfo = {
      space: {
        type: visibility,
        title: visibility.substr(0, 1).toUpperCase() + visibility.substr(1),
      },
      type: this.listType,
      title: this.listName(),
      emoji: '📝',
    };
    this.closeDialog(listInfo).catch(this.errorLogger.logError);
  }

  cancel(): void {
    this.closeDialog().catch(this.errorLogger.logError);
  }

  async closeDialog(listInfo?: IListInfo): Promise<void> {
    await this.modal?.dismiss(listInfo, 'cancel');
  }
}

import {Component, OnDestroy, OnInit} from '@angular/core';
import {catchError, Observable, of, Subscription, switchMap} from "rxjs";
import {signInPageUrl} from "../../../app-routing.module";
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {RedirectService} from "../../../infrastructure/adapters/services/redirect.service";
import {UserService} from "../../../core/usecases/interactors/user.service";
import {AuthenticationService} from "../../../core/usecases/interactors/authentication.service";
import {UniqueUsernameValidator} from "../../shared/validators/unique-username-validator";

const INCORRECT_INPUT_ERROR: Error = new Error('Некорректный ввод');

const CORRECT_PASSWORD_PATTERN: string = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$';

@Component({
  selector: 'app-sign-up-page',
  templateUrl: './sign-up-page.component.html',
  styleUrls: ['./sign-up-page.component.scss']
})
export class SignUpPageComponent implements OnInit, OnDestroy {
  public form: FormGroup;

  public error: string = '';

  private isSignedInSubscription!: Subscription;
  private createUserSubscription!: Subscription;

  constructor(private uniqueUsernameValidator: UniqueUsernameValidator,
              private authenticationService: AuthenticationService,
              private userService: UserService,
              private redirectService: RedirectService) {
    this.form = new FormGroup({
      username: new FormControl(null, {
        validators: [
          Validators.required,
          Validators.minLength(8)
        ],
        asyncValidators: [this.uniqueUsernameValidator.validate.bind(this.uniqueUsernameValidator)],
        updateOn: "blur"
      }),
      password: new FormControl(null, [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(CORRECT_PASSWORD_PATTERN)
      ])
    });
  }

  public ngOnInit(): void {
    this.form.disable();
    this.isSignedInSubscription = this.authenticationService.isSignedIn()
      .pipe(
        catchError(() => {
          return of(false);
        }),
        switchMap((isSignedIn: boolean): Observable<boolean> => {
          return this.redirectService.redirectIf(isSignedIn, '');
        })
      ).subscribe((redirectedToMain: boolean): void => {
        if (!redirectedToMain)
          this.form.enable();
      });
  }

  public showError(error: Error): void {
    this.error = error.message;
  }

  public onSubmit(): void {
    const username = this.form.value['username'];
    const password = this.form.value['password'];

    if (username && password) {
      this.form.disable();
      this.createUserSubscription = this.userService.createUser(username, password)
        .pipe(
          catchError((error) => {
            this.form.enable();
            this.showError(error);
            return of(false);
          }),
          switchMap((status) => {
            if (status != false)
              return this.authenticationService.signOut();
            return of(false);
          }),
          switchMap((status) => {
            return this.redirectService.redirectIf(status != false, signInPageUrl);
          })
        ).subscribe();
    } else {
      this.showError(INCORRECT_INPUT_ERROR);
    }
  }

  public ngOnDestroy(): void {
    if (this.isSignedInSubscription)
      this.isSignedInSubscription.unsubscribe();
    if (this.createUserSubscription)
      this.createUserSubscription.unsubscribe();
  }
}

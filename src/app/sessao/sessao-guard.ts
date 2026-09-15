import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { SessaoStore } from './sessao-store';

export const sessaoGuard: CanActivateFn = () => {
  const sessao = inject(SessaoStore);
  const router = inject(Router);

  return sessao
    .restaurar()
    .pipe(map((corretor) => (corretor ? true : router.createUrlTree(['/entrar']))));
};

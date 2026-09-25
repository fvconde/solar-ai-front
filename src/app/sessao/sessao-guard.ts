import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { destinoDe } from '../entrar/entrar-contrato';
import { SessaoStore } from './sessao-store';

export const entrarGuard: CanActivateFn = () => {
  const sessao = inject(SessaoStore);
  const router = inject(Router);

  return sessao
    .restaurar()
    .pipe(map((resposta) => (resposta ? router.createUrlTree(destinoDe(resposta)) : true)));
};

export const sessaoGuard: CanActivateFn = () => {
  const sessao = inject(SessaoStore);
  const router = inject(Router);

  return sessao
    .restaurar()
    .pipe(map((resposta) => (resposta ? true : router.createUrlTree(['/entrar']))));
};

export const painelGuard: CanActivateFn = () => {
  const sessao = inject(SessaoStore);
  const router = inject(Router);

  return sessao.restaurar().pipe(
    map((resposta) => {
      if (!resposta) {
        return router.createUrlTree(['/entrar']);
      }
      return resposta.perfil === 'cliente' ? router.createUrlTree(['/']) : true;
    }),
  );
};

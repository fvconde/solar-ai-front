import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('monta a aplicação', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('abre pedindo o consentimento', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-aviso-consentimento')).toBeTruthy();
  });
});

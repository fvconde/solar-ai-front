import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Chat } from './chat';

describe('Chat', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('monta o chat', () => {
    const fixture = TestBed.createComponent(Chat);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('abre pedindo o consentimento', () => {
    const fixture = TestBed.createComponent(Chat);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-aviso-consentimento')).toBeTruthy();
    expect(html.textContent).toContain('esse provedor usa o conteúdo para treino');
    expect(html.textContent).toContain('a Solar compartilha a conversa com um corretor humano');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Chat } from './chat';

describe('Chat', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
  });
});

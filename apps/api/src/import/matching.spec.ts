import { foldForSearch, slugify } from '@mybook/shared';
import { authorsOverlap, isbn10To13, titlesMatch } from './matching.js';

describe('foldForSearch', () => {
  it('ignores Turkish case and accents', () => {
    expect(foldForSearch('İnce Memed')).toBe('ince memed');
    expect(foldForSearch('INCE MEMED')).toBe('ince memed');
    expect(foldForSearch('Şeker Portakalı')).toBe('seker portakali');
    expect(foldForSearch('Gödel, Escher, Bach')).toBe('godel escher bach');
  });

  it('makes readable slugs', () => {
    expect(slugify('Kürk Mantolu Madonna')).toBe('kurk-mantolu-madonna');
    expect(slugify("İvan İlyiç'in Ölümü")).toBe('ivan-ilyic-in-olumu');
  });
});

describe('titlesMatch', () => {
  it('matches the same title with different casing or an extra subtitle', () => {
    expect(titlesMatch('Kurk Mantolu Madonna', 'Kürk Mantolu Madonna')).toBe(true);
    expect(titlesMatch('Code: The Hidden Language of Computer Hardware and Software', 'Code')).toBe(true);
  });

  it('does not match a different book that starts with the same word', () => {
    expect(titlesMatch('Codex', 'Code')).toBe(false);
    expect(titlesMatch("Ahmet Hamdi Tanpınar'ın Saatleri Ayarlama Enstitüsü", 'Saatleri Ayarlama Enstitüsü')).toBe(false);
  });
});

describe('authorsOverlap', () => {
  it('compares surnames, ignoring accents and suffixes', () => {
    expect(authorsOverlap(['Oguz Atay'], ['Oğuz Atay'])).toBe(true);
    expect(authorsOverlap(['Fyodor Mihayloviç Dostoyevski'], ['Fyodor Dostoyevski'])).toBe(true);
    expect(authorsOverlap(['Frederick P. Brooks'], ['Frederick P. Brooks Jr.'])).toBe(true);
    expect(authorsOverlap(['Necip Tosun'], ['Ahmet Hamdi Tanpınar'])).toBe(false);
  });
});

describe('isbn10To13', () => {
  it('converts with the right check digit', () => {
    expect(isbn10To13('0306406152')).toBe('9780306406157');
    expect(isbn10To13('014044913X')).toBe('9780140449136');
  });
});

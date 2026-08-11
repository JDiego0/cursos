import { TestBed } from '@angular/core/testing';
import { ResaltadorService } from './resaltador.service';

describe('ResaltadorService', () => {
  let resaltador: ResaltadorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    resaltador = TestBed.inject(ResaltadorService);
  });

  /** Quita el marcado para comprobar que el texto sobrevive intacto. */
  const soloTexto = (html: string) =>
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

  it('no altera el código, sólo lo envuelve', () => {
    const fuente = 'if (a < b && c > d) { return "hola"; }';
    expect(soloTexto(resaltador.resaltar(fuente, 'Java'))).toBe(fuente);
  });

  it('escapa el HTML del código para que no se ejecute', () => {
    const salida = resaltador.resaltar('const x = "<script>alert(1)</script>";', 'JavaScript');
    expect(salida).not.toContain('<script>');
    expect(salida).toContain('&lt;script&gt;');
  });

  it('colorea palabras reservadas y tipos de Java', () => {
    const salida = resaltador.resaltar('public class Libro { }', 'Java');
    expect(salida).toContain('<span class="c-key">public</span>');
    expect(salida).toContain('<span class="c-key">class</span>');
  });

  it('trata «//» como comentario en Java pero no en Python', () => {
    expect(resaltador.resaltar('int x = 1; // nota', 'Java')).toContain('c-com">// nota');
    expect(resaltador.resaltar('x = 7 // 2', 'Python')).not.toContain('c-com');
  });

  it('trata «#» como comentario en Python pero no en Java', () => {
    expect(resaltador.resaltar('x = 1  # nota', 'Python')).toContain('c-com">');
    expect(resaltador.resaltar('String s = "#hash";', 'Java')).not.toContain('c-com');
  });

  it('no abre un comentario dentro de una cadena', () => {
    const salida = resaltador.resaltar('url = "https://ejemplo.com" # real', 'Python');
    /* La cadena entera es un solo fragmento: ni las dos barras ni la
       almohadilla de dentro abren comentario. */
    expect(salida).toContain('<span class="c-str">"https://ejemplo.com"</span>');
    expect(salida).toContain('<span class="c-com"># real</span>');
  });

  it('reconoce etiquetas sólo en lenguajes de marcado', () => {
    expect(resaltador.resaltar('<dependency>', 'XML · pom.xml')).toContain('c-tag');
    /* En Java, «List<String>» no es una etiqueta: es un genérico. */
    const java = resaltador.resaltar('List<String> libros;', 'Java');
    expect(java).not.toContain('c-tag');
    expect(java).toContain('c-typ">String');
  });

  it('resalta el comando y sus banderas en la terminal', () => {
    const salida = resaltador.resaltar('az group create --name rg-nakashop', 'Azure CLI');
    expect(salida).toContain('<span class="c-cmd">az</span>');
    expect(salida).toContain('<span class="c-flag">--name</span>');
  });

  it('deja intacta la salida de un programa', () => {
    const fuente = 'BUILD SUCCESS\nTotal time: 2.145 s';
    expect(resaltador.resaltar(fuente, 'Salida')).toBe(fuente);
  });

  it('nunca colorea dos veces el mismo fragmento', () => {
    const salida = resaltador.resaltar('/* class public */', 'Java');
    expect(salida).toBe('<span class="c-com">/* class public */</span>');
  });
});

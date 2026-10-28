import { ordenarVoces, prepararParaVoz, puntuarVoz, siguientePalabra, trocear } from './voz.service';

const voz = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe('puntuarVoz / ordenarVoces', () => {
  it('prefiere una voz natural femenina a una local o masculina', () => {
    const voces = [
      voz('Microsoft Helena - Spanish (Spain)', 'es-ES'),
      voz('Microsoft Jorge Online (Natural) - Spanish (Mexico)', 'es-MX'),
      voz('Google español', 'es-ES'),
      voz('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX'),
      voz('Microsoft Zira - English (United States)', 'en-US'),
    ];
    expect(ordenarVoces(voces).map((v) => v.name)).toEqual([
      'Microsoft Dalia Online (Natural) - Spanish (Mexico)',
      'Google español',
      'Microsoft Jorge Online (Natural) - Spanish (Mexico)',
      'Microsoft Helena - Spanish (Spain)',
    ]);
  });

  it('reconoce nombres con tilde', () => {
    expect(puntuarVoz(voz('Microsoft Salomé Online (Natural)', 'es-CO'))).toBeGreaterThan(
      puntuarVoz(voz('Microsoft Álvaro Online (Natural)', 'es-ES')),
    );
  });
});

describe('prepararParaVoz', () => {
  it('quita emojis y convierte flechas y separadores en pausas', () => {
    expect(prepararParaVoz('📖 Teoría')).toBe('Teoría');
    expect(prepararParaVoz('Cliente → API · Base de datos')).toBe('Cliente, API, Base de datos');
    expect(prepararParaVoz('  ⚠️  Errores   comunes ')).toBe('Errores comunes');
  });
});

describe('siguientePalabra', () => {
  it('salta la palabra que empieza en la posición dada', () => {
    const texto = 'Aprende JAVA  con LibroTech';
    expect(texto.slice(siguientePalabra(texto, 0))).toBe('JAVA  con LibroTech');
    expect(texto.slice(siguientePalabra(texto, 8))).toBe('con LibroTech');
  });

  it('devuelve el final del texto en la última palabra', () => {
    expect(siguientePalabra('Aprende JAVA', 8)).toBe(12);
  });
});

describe('trocear', () => {
  it('junta frases cortas y no supera el máximo', () => {
    const trozos = trocear('Uno. Dos. Tres.', 10);
    expect(trozos).toEqual(['Uno. Dos.', 'Tres.']);
  });

  it('parte por palabras una frase demasiado larga', () => {
    const trozos = trocear('palabra '.repeat(60).trim(), 50);
    expect(trozos.every((t) => t.length <= 50)).toBe(true);
    expect(trozos.join(' ')).toBe('palabra '.repeat(60).trim());
  });
});

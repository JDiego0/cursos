import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marca como segura una cadena de HTML para poder pintarla con
 * `[innerHTML]`.
 *
 * Se usa **sólo** con contenido del propio repositorio: los textos
 * de los capítulos, el glosario y las notas, que genera
 * `herramientas/migrar-contenido.js` a partir de los cursos y que no
 * contienen ni `<script>` ni manejadores `on*` (el extractor lo
 * comprueba). Nunca debe aplicarse a texto que venga del usuario ni
 * de una API externa: para eso está la sanitización por defecto de
 * Angular, que es justo lo que esta tubería desactiva.
 */
@Pipe({ name: 'htmlSeguro' })
export class HtmlSeguroPipe implements PipeTransform {
  private readonly sanitizador = inject(DomSanitizer);

  transform(html: string | null | undefined): SafeHtml {
    return this.sanitizador.bypassSecurityTrustHtml(html ?? '');
  }
}

/**
 * Variante para texto que **no** es de confianza: lo limpia en vez
 * de confiar en él. La usa el buscador con los fragmentos, que
 * llevan la consulta escrita por el usuario dentro de un `<mark>`.
 */
@Pipe({ name: 'htmlLimpio' })
export class HtmlLimpioPipe implements PipeTransform {
  private readonly sanitizador = inject(DomSanitizer);

  transform(html: string | null | undefined): string {
    return this.sanitizador.sanitize(SecurityContext.HTML, html ?? '') ?? '';
  }
}

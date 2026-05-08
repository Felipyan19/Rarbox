const addRequestId = require('../utils/request-id');

// Named entities for the most common special characters
const NAMED_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  'á': '&aacute;', 'Á': '&Aacute;',
  'à': '&agrave;', 'À': '&Agrave;',
  'â': '&acirc;',  'Â': '&Acirc;',
  'ä': '&auml;',   'Ä': '&Auml;',
  'ã': '&atilde;', 'Ã': '&Atilde;',
  'å': '&aring;',  'Å': '&Aring;',
  'æ': '&aelig;',  'Æ': '&AElig;',
  'é': '&eacute;', 'É': '&Eacute;',
  'è': '&egrave;', 'È': '&Egrave;',
  'ê': '&ecirc;',  'Ê': '&Ecirc;',
  'ë': '&euml;',   'Ë': '&Euml;',
  'í': '&iacute;', 'Í': '&Iacute;',
  'ì': '&igrave;', 'Ì': '&Igrave;',
  'î': '&icirc;',  'Î': '&Icirc;',
  'ï': '&iuml;',   'Ï': '&Iuml;',
  'ó': '&oacute;', 'Ó': '&Oacute;',
  'ò': '&ograve;', 'Ò': '&Ograve;',
  'ô': '&ocirc;',  'Ô': '&Ocirc;',
  'ö': '&ouml;',   'Ö': '&Ouml;',
  'õ': '&otilde;', 'Õ': '&Otilde;',
  'ø': '&oslash;', 'Ø': '&Oslash;',
  'ú': '&uacute;', 'Ú': '&Uacute;',
  'ù': '&ugrave;', 'Ù': '&Ugrave;',
  'û': '&ucirc;',  'Û': '&Ucirc;',
  'ü': '&uuml;',   'Ü': '&Uuml;',
  'ý': '&yacute;', 'Ý': '&Yacute;',
  'ÿ': '&yuml;',
  'ñ': '&ntilde;', 'Ñ': '&Ntilde;',
  'ç': '&ccedil;', 'Ç': '&Ccedil;',
  'ß': '&szlig;',
  '¿': '&iquest;', '¡': '&iexcl;',
  '©': '&copy;',   '®': '&reg;',   '™': '&trade;',
  '€': '&euro;',   '£': '&pound;', '¥': '&yen;',  '¢': '&cent;',
  '°': '&deg;',    '±': '&plusmn;','µ': '&micro;',
  'º': '&ordm;',   'ª': '&ordf;',  '\u00A0': '&nbsp;',
  '§': '&sect;',   '¶': '&para;',
  '·': '&middot;', '»': '&raquo;', '«': '&laquo;',
  '½': '&frac12;', '¼': '&frac14;','¾': '&frac34;',
  '×': '&times;',  '÷': '&divide;',
  '–': '&ndash;',  '—': '&mdash;',
  '‘': '&lsquo;', '’': '&rsquo;',
  '“': '&ldquo;', '”': '&rdquo;',
  '…': '&hellip;', '•': '&bull;',
  '←': '&larr;',  '→': '&rarr;',  '↑': '&uarr;', '↓': '&darr;',
  '♠': '&spades;', '♣': '&clubs;', '♥': '&hearts;','♦': '&diams;',
};

const NAMED_ENTITIES_REGEX = new RegExp(
  `[${Object.keys(NAMED_ENTITIES).map((c) => c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('')}]`,
  'g'
);

function encodeHtml(html) {
  return html.replace(NAMED_ENTITIES_REGEX, (char) => NAMED_ENTITIES[char] || `&#${char.charCodeAt(0)};`);
}

async function htmlRoutes(fastify) {
  fastify.addHook('preHandler', addRequestId);

  fastify.post('/v1/html/encode', {
    schema: {
      tags: ['HTML'],
      summary: 'Encode special characters to HTML entities',
      description:
        'Replaces accented characters, symbols and special characters with their HTML entity equivalents (e.g. á → &aacute;) for maximum email and browser compatibility.',
      body: {
        type: 'object',
        required: ['html'],
        properties: {
          html: {
            type: 'string',
            description: 'HTML content to encode',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            html: { type: 'string', description: 'HTML with all special characters replaced by entities' },
            stats: {
              type: 'object',
              properties: {
                originalLength:  { type: 'integer' },
                encodedLength:   { type: 'integer' },
                replacements:    { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { html } = request.body;

    let replacements = 0;
    const encoded = html.replace(
      NAMED_ENTITIES_REGEX,
      (char) => {
        replacements++;
        return NAMED_ENTITIES[char] || `&#${char.charCodeAt(0)};`;
      }
    );

    request.log.info(
      { requestId: request.id, originalLength: html.length, replacements },
      'HTML entities encoded'
    );

    return reply.send({
      html: encoded,
      stats: {
        originalLength: html.length,
        encodedLength:  encoded.length,
        replacements,
      },
    });
  });
}

module.exports = htmlRoutes;

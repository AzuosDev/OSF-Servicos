import { BudgetDocument } from '../schemas/budget.schema';
import { ClientDocument } from '../schemas/client.schema';
import { CompanySettingsDocument } from '../schemas/company-settings.schema';
import { OSF_LOGO_BASE64 } from './osf-logo-base64';
import { escapeHtml, formatCurrency } from './format';

/**
 * Capa da proposta de venda de sistema fotovoltaico.
 *
 * Usa o azul do painel solar da própria logo (#14345F) como fundo e o dourado (#F0AC28)
 * como único acento — as duas cores da marca, nada inventado. A logo fica centrada sobre
 * uma placa clara para ficar legível independentemente do fundo dela.
 *
 * O orçamento de serviços não tem capa: é um documento de uma página, e uma capa nele
 * seria cerimônia sem função. Aqui ela existe porque a proposta tem várias seções e vai
 * para a mão do cliente como peça comercial.
 */

const infoField = (label: string, value?: string) =>
  value
    ? `<div class="cover-field">
         <span class="cover-field-label">${escapeHtml(label)}</span>
         <span class="cover-field-value">${escapeHtml(value)}</span>
       </div>`
    : '';

export function buildCoverHtml(
  budget: BudgetDocument,
  client: ClientDocument,
  company: CompanySettingsDocument,
  issuedAt: string,
  validUntil: string,
): string {
  const power = budget.solar?.generation?.systemPowerKwp;

  return `<section class="cover">
    <div class="cover-top">
      <span class="cover-eyebrow">Proposta comercial</span>
    </div>

    <div class="cover-center">
      <div class="cover-logo-plate">
        <img src="data:image/png;base64,${OSF_LOGO_BASE64}" alt="${escapeHtml(company.companyName)}" />
      </div>
      <div class="cover-rule"></div>
      <p class="cover-company">Proposta</p>
    </div>

    <div class="cover-bottom">
      <div class="cover-grid">
        ${infoField('Cliente', client.name)}
        ${infoField('Orçamento', `Nº ${String(budget.sequenceNumber).padStart(4, '0')}`)}
        ${infoField('Emissão', issuedAt)}
        ${infoField('Validade', validUntil)}
        ${infoField('Potência do sistema', power != null ? `${power.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp` : undefined)}
        ${infoField('Investimento', formatCurrency(budget.total))}
      </div>
    </div>
  </section>`;
}

/**
 * Estilos da capa.
 *
 * A altura é a da **caixa de conteúdo**, não a da folha: o cabeçalho e o rodapé de página
 * consomem 22mm no topo e 16mm na base, e o Chromium recorta tudo que passa disso. Uma capa
 * de 297mm aqui teria a grade de informações cortada fora — foi exatamente o que aconteceu
 * na primeira versão.
 */
const CONTENT_HEIGHT = '259mm'; // 297mm - 22mm (cabeçalho) - 16mm (rodapé)

/**
 * A logo é o elemento principal da capa: ocupa ~30% da folha A4 (89mm de 297mm de altura).
 * A placa branca circular existe para a logo ficar legível sobre o azul — a proporção entre
 * a placa e a imagem dentro dela é a mesma da versão anterior, só que em escala.
 */
const LOGO_PLATE_SIZE = '89mm';
const LOGO_IMAGE_SIZE = '58mm';

export const COVER_STYLES = `
  .cover {
    position: relative;
    height: ${CONTENT_HEIGHT};
    margin: 0 0 0;
    padding: 20mm 16mm 14mm;
    border-radius: 12px;
    background: #14345F;
    color: #FFFFFF;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    overflow: hidden;
  }

  /* Faixa dourada no topo — a mesma régua que separa as seções do documento. */
  .cover::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 6px;
    background: #F0AC28;
    border-radius: 12px 12px 0 0;
  }

  /* Arco discreto atrás do conteúdo: dá profundidade sem virar enfeite. */
  .cover::after {
    content: "";
    position: absolute;
    right: -90mm;
    bottom: -110mm;
    width: 220mm;
    height: 220mm;
    border-radius: 50%;
    background: rgba(47, 91, 148, 0.35);
  }

  .cover-top, .cover-center, .cover-bottom { position: relative; z-index: 1; }

  .cover-eyebrow {
    font-size: 10px;
    letter-spacing: 3.4px;
    text-transform: uppercase;
    color: #F0AC28;
    font-weight: 700;
  }

  .cover-center { text-align: center; }

  .cover-logo-plate {
    width: ${LOGO_PLATE_SIZE};
    height: ${LOGO_PLATE_SIZE};
    margin: 0 auto;
    border-radius: 50%;
    /* O PNG da logo nao tem fundo transparente: e um quadrado branco de #FEFEFE. Com a placa
       em branco puro a diferenca de um ponto aparecia como uma moldura quadrada visivel
       dentro do circulo. Igualar o tom faz o quadrado sumir. */
    background: #FEFEFE;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover-logo-plate img { width: ${LOGO_IMAGE_SIZE}; height: ${LOGO_IMAGE_SIZE}; object-fit: contain; }

  .cover-rule {
    width: 64px;
    height: 3px;
    background: #F0AC28;
    margin: 26px auto 22px;
    border-radius: 2px;
  }

  .cover-company {
    margin: 0;
    font-size: 26px;
    letter-spacing: 7px;
    text-transform: uppercase;
    color: #FFFFFF;
    font-weight: 700;
  }

  .cover-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.18);
  }

  .cover-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .cover-field-label {
    font-size: 8.5px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    font-weight: 600;
  }
  .cover-field-value {
    font-size: 13px;
    font-weight: 700;
    color: #FFFFFF;
    word-break: break-word;
  }
`;

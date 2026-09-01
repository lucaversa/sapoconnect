import { describe, expect, it } from 'vitest';
import {
  buildFrequencyReviewParameter,
  parseFrequencyReviewDates,
  parseFrequencyReviewForm,
  parseFrequencyReviewPath,
} from '@/lib/frequency-review-parser';

describe('frequency review parser', () => {
  it('discovers the frequency review link without changing opaque tokens', () => {
    const html = `
      <ul>
        <li>
          <a href="/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir?codGrupoAtendimento=%255cC2%255c07&amp;codOpcaoAtendimento=%255cEB%255cBA">
            <h5>REVIS&#195;O DE FREQU&#202;NCIA (REQUERIMENTOS PORTAL ALUNO)</h5>
          </a>
        </li>
      </ul>
    `;

    const path = parseFrequencyReviewPath(html);

    expect(path).toBe(
      '/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir?codGrupoAtendimento=%255cC2%255c07&codOpcaoAtendimento=%255cEB%255cBA'
    );
    expect(path).not.toContain('%25255c');
  });

  it('rejects a frequency review link outside the configured TOTVS origin', () => {
    const html = '<a href="https://example.com/EducaMobile/Educacional/EduAluno/EduAcompanhaSolicitacoesIncluir">REVISÃO DE FREQUÊNCIA</a>';
    expect(parseFrequencyReviewPath(html)).toBeNull();
  });

  it('extracts disciplines and builds the dependent parameter from the form', () => {
    const html = `
      <form>
        <h1>REVIS&#195;O DE FREQU&#202;NCIA</h1>
        <input name="NOMETIPO" value="REVISÃO DE FREQUÊNCIA" />
        <label for="field_param_53">Disciplinas para Revisão: *</label>
        <select
          id="field_param_53"
          onchange="onChangeCampoParametroDependencia(1, &#39;S&#39;, &#39;CRM.EDU.36.008&#39;, &#39;54&#39;, &#39;PARAMETRO_53&#39;)"
        >
          <option value="">Selecione uma opção</option>
          <option value="1-8405-160">SA&#218;DE DA CRIAN&#199;A E DO ADOLESCENTE III</option>
        </select>
      </form>
    `;

    const form = parseFrequencyReviewForm(html);

    expect(form).toEqual({
      disciplinas: [
        {
          codigo: '1-8405-160',
          disciplina: 'SAÚDE DA CRIANÇA E DO ADOLESCENTE III',
        },
      ],
      dependencia: {
        codColigada: '1',
        codAplicacao: 'S',
        codSentencaDependencia: 'CRM.EDU.36.008',
        codParametroDependencia: '54',
        nomeParametroDependencia: 'PARAMETRO_53',
      },
    });
    expect(buildFrequencyReviewParameter(form!.dependencia, '1-8405-160')).toBe(
      '1;S;CRM.EDU.36.008|1-8405-160|0|PARAMETRO_53'
    );
  });

  it('sorts and deduplicates valid dates while preserving an empty result', () => {
    expect(parseFrequencyReviewDates([
      { Selected: false, Text: '24/08/2026', Value: '24/08/2026' },
      { Selected: false, Text: '10/08/2026', Value: '10/08/2026' },
      { Selected: false, Text: '10/08/2026', Value: '10/08/2026' },
      { Selected: false, Text: '31/02/2026', Value: '31/02/2026' },
    ])).toEqual([
      { data: '2026-08-10', label: '10/08/2026' },
      { data: '2026-08-24', label: '24/08/2026' },
    ]);
    expect(parseFrequencyReviewDates([])).toEqual([]);
  });

  it('treats a changed upstream schema as invalid instead of no absences', () => {
    expect(parseFrequencyReviewDates({ dates: [] })).toBeNull();
    expect(parseFrequencyReviewDates([{ label: '10/08/2026' }])).toBeNull();
  });
});

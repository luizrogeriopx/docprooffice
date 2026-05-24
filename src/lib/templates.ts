export type TemplateKey = "resume" | "letter" | "invoice" | "report" | "budget";

export const TEMPLATE_TITLES: Record<TemplateKey, string> = {
  resume: "Currículo",
  letter: "Carta",
  invoice: "Fatura",
  report: "Relatório",
  budget: "Orçamento",
};

const today = () => new Date().toLocaleDateString("pt-BR");

export const TEMPLATES: Record<TemplateKey, string> = {
  resume: `
    <h1 style="text-align:center">Seu Nome Completo</h1>
    <p style="text-align:center"><strong>Cargo desejado</strong></p>
    <p style="text-align:center">São Paulo, SP · (11) 99999-9999 · seu.email@exemplo.com · linkedin.com/in/seunome</p>
    <h2>Resumo Profissional</h2>
    <p>Profissional com X anos de experiência em [área], com sólida atuação em [principais competências]. Comprometido com resultados, trabalho em equipe e aprendizado contínuo.</p>
    <h2>Experiência Profissional</h2>
    <h3>Cargo — Empresa</h3>
    <p><em>jan/2022 — Atual · São Paulo, SP</em></p>
    <ul>
      <li>Principal responsabilidade ou conquista mensurável.</li>
      <li>Outra responsabilidade relevante com impacto no negócio.</li>
      <li>Projeto de destaque com resultado quantitativo.</li>
    </ul>
    <h3>Cargo Anterior — Empresa</h3>
    <p><em>mar/2019 — dez/2021 · São Paulo, SP</em></p>
    <ul>
      <li>Descrição da responsabilidade principal.</li>
      <li>Conquista relevante.</li>
    </ul>
    <h2>Formação Acadêmica</h2>
    <p><strong>Bacharelado em [Curso]</strong> — Universidade XYZ (2015 — 2019)</p>
    <h2>Habilidades</h2>
    <ul>
      <li>Habilidade técnica 1</li>
      <li>Habilidade técnica 2</li>
      <li>Idiomas: Português (nativo), Inglês (avançado)</li>
    </ul>
  `,
  letter: `
    <p style="text-align:right">São Paulo, ${today()}</p>
    <p><strong>Para:</strong> [Nome do Destinatário]<br/>[Cargo / Empresa]<br/>[Endereço]</p>
    <p><strong>Assunto:</strong> [Assunto da carta]</p>
    <p>Prezado(a) [Nome],</p>
    <p>Espero que esta carta o(a) encontre bem. Escrevo para [explicar o motivo principal da carta de forma clara e objetiva].</p>
    <p>[Desenvolva aqui o conteúdo principal, apresentando os pontos importantes em parágrafos curtos e bem estruturados. Mantenha um tom cordial e profissional.]</p>
    <p>Agradeço desde já a atenção dispensada e coloco-me à disposição para quaisquer esclarecimentos adicionais.</p>
    <p>Atenciosamente,</p>
    <p><br/>__________________________<br/><strong>Seu Nome</strong><br/>[Seu cargo]<br/>[Contato]</p>
  `,
  invoice: `
    <h1>FATURA</h1>
    <p><strong>Nº:</strong> 0001 &nbsp;&nbsp; <strong>Data:</strong> ${today()} &nbsp;&nbsp; <strong>Vencimento:</strong> ___/___/_____</p>
    <table>
      <tbody>
        <tr>
          <td><strong>De:</strong><br/>Sua Empresa Ltda.<br/>CNPJ: 00.000.000/0001-00<br/>Endereço completo<br/>contato@suaempresa.com</td>
          <td><strong>Para:</strong><br/>Nome do Cliente<br/>CNPJ/CPF: 000.000.000-00<br/>Endereço do cliente<br/>cliente@email.com</td>
        </tr>
      </tbody>
    </table>
    <h3>Itens</h3>
    <table>
      <thead>
        <tr><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr><td>Serviço/Produto 1</td><td>1</td><td>1000</td><td>=B2*C2</td></tr>
        <tr><td>Serviço/Produto 2</td><td>2</td><td>500</td><td>=B3*C3</td></tr>
        <tr><td></td><td></td><td><strong>Subtotal</strong></td><td>=SUM(D2:D3)</td></tr>
        <tr><td></td><td></td><td><strong>Impostos</strong></td><td>0</td></tr>
        <tr><td></td><td></td><td><strong>Total</strong></td><td>=D4+D5</td></tr>
      </tbody>
    </table>
    <p style="font-size:0.85em;color:#666"><em>Dica: as células com <strong>ƒx</strong> são fórmulas automáticas. Edite valores nas colunas Qtd e Valor Unit. — os totais recalculam sozinhos.</em></p>
    <h3>Forma de pagamento</h3>
    <p>PIX: chave@email.com · Banco XYZ · Ag. 0000 · Conta 00000-0</p>
    <p><em>Obrigado pela preferência!</em></p>
  `,
  report: `
    <h1>Relatório [Título]</h1>
    <p><strong>Autor:</strong> Seu Nome &nbsp;·&nbsp; <strong>Data:</strong> ${today()}</p>
    <h2>1. Sumário Executivo</h2>
    <p>Breve descrição dos principais achados e conclusões deste relatório.</p>
    <h2>2. Introdução</h2>
    <p>Contexto, objetivos e escopo do trabalho realizado.</p>
    <h2>3. Metodologia</h2>
    <p>Descreva como os dados foram coletados e analisados.</p>
    <h2>4. Resultados</h2>
    <ul>
      <li>Resultado principal 1</li>
      <li>Resultado principal 2</li>
      <li>Resultado principal 3</li>
    </ul>
    <h2>5. Análise</h2>
    <p>Interpretação detalhada dos resultados apresentados.</p>
    <h2>6. Conclusões e Recomendações</h2>
    <p>Principais conclusões e próximos passos sugeridos.</p>
    <h2>7. Anexos</h2>
    <p>Materiais complementares e referências.</p>
  `,
  budget: `
    <h1>ORÇAMENTO</h1>
    <p><strong>Nº:</strong> 0001 &nbsp;&nbsp; <strong>Data:</strong> ${today()} &nbsp;&nbsp; <strong>Validade:</strong> 15 dias</p>
    <table>
      <tbody>
        <tr>
          <td><strong>Empresa:</strong><br/>Sua Empresa Ltda.<br/>CNPJ: 00.000.000/0001-00<br/>contato@suaempresa.com</td>
          <td><strong>Cliente:</strong><br/>Nome do Cliente<br/>CNPJ/CPF: 000.000.000-00<br/>cliente@email.com</td>
        </tr>
      </tbody>
    </table>
    <h3>Descrição dos Serviços</h3>
    <table>
      <thead>
        <tr><th>Item</th><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr><td>1</td><td>Serviço A</td><td>1</td><td>1500</td><td>=C2*D2</td></tr>
        <tr><td>2</td><td>Serviço B</td><td>10</td><td>150</td><td>=C3*D3</td></tr>
        <tr><td></td><td></td><td></td><td><strong>Total Geral</strong></td><td>=SUM(E2:E3)</td></tr>
      </tbody>
    </table>
    <p style="font-size:0.85em;color:#666"><em>Dica: as células com <strong>ƒx</strong> são fórmulas automáticas (ex.: <code>=C2*D2</code>, <code>=SUM(E2:E3)</code>). Edite Qtd e Valor Unit. — os totais recalculam sozinhos.</em></p>
    <h3>Condições</h3>
    <ul>
      <li><strong>Prazo de entrega:</strong> a combinar</li>
      <li><strong>Forma de pagamento:</strong> 50% na aprovação + 50% na entrega</li>
      <li><strong>Validade da proposta:</strong> 15 dias</li>
    </ul>
    <p>Em caso de aprovação, favor responder este orçamento. Estamos à disposição para esclarecimentos.</p>
  `,
};

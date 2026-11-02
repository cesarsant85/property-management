        // CHAVES DO LOCALSTORAGE
        const STORAGE_RECEBIMENTOS = 'aluguelcontrol_recebimentos';
        const STORAGE_DESPESAS = 'aluguelcontrol_despesas';
        const STORAGE_IMOVEIS = 'aluguelcontrol_imoveis';
        const STORAGE_AJUSTES = 'aluguelcontrol_ajustes_saldo';

        // ESTADO GLOBAL DA APLICAÇÃO
        let dadosRecebimentos = [];
        let dadosDespesas = [];
        let dadosImoveis = [];
        let dadosAjustes = [];

        let chartMensalInstance = null;
        let chartCategoriasInstance = null;

        // INICIALIZAÇÃO
        window.onload = function() {
            document.getElementById('print-date').innerText = new Date().toLocaleDateString('pt-BR');
            carregarDadosDoStorage();
            povoarSelectMeses();
            renderizarImoveis();
            atualizarDropdownsImoveis();
            renderizarTabelaLancamentos();
            atualizarKPIs();
            inicializarGraficos();
        };

        // CARREGAMENTO E PERSISTÊNCIA NO LOCALSTORAGE
        function carregarDadosDoStorage() {
            try { dadosAjustes = JSON.parse(localStorage.getItem(STORAGE_AJUSTES) || '[]'); } catch (e) { dadosAjustes = []; }
            const recStorage = localStorage.getItem(STORAGE_RECEBIMENTOS);
            const despStorage = localStorage.getItem(STORAGE_DESPESAS);
            const imovStorage = localStorage.getItem(STORAGE_IMOVEIS);

            if (recStorage) {
                dadosRecebimentos = JSON.parse(recStorage);
            } else {
                carregarExemploInicial();
            }

            if (despStorage) {
                dadosDespesas = JSON.parse(despStorage);
            } else if (!recStorage) {
                carregarExemploDespesas();
            }

            if (imovStorage) {
                dadosImoveis = JSON.parse(imovStorage);
            } else if (!recStorage) {
                carregarExemploImoveis();
            }
        }

        function salvarStorage() {
            localStorage.setItem(STORAGE_RECEBIMENTOS, JSON.stringify(dadosRecebimentos));
            localStorage.setItem(STORAGE_DESPESAS, JSON.stringify(dadosDespesas));
            localStorage.setItem(STORAGE_IMOVEIS, JSON.stringify(dadosImoveis));
            localStorage.setItem(STORAGE_AJUSTES, JSON.stringify(dadosAjustes));
        }

        // PREENCHE A CAIXA DE SELEÇÃO DE MESES DINAMICAMENTE COM BASE NOS DADOS
        function povoarSelectMeses() {
            const selectMes = document.getElementById('filter-global-mes');
            const valorAtual = selectMes.value;
            const mesesSet = new Set();

            dadosRecebimentos.forEach(item => {
                if (item.vencimento) mesesSet.add(item.vencimento.substring(0, 7));
            });
            dadosDespesas.forEach(item => {
                if (item.data) mesesSet.add(item.data.substring(0, 7));
            });

            // Ordena os meses em ordem decrescente
            const mesesOrdenados = Array.from(mesesSet).sort().reverse();

            selectMes.innerHTML = '<option value="">Todos os Meses</option>';
            mesesOrdenados.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.innerText = formatarMesAnoExtenso(m);
                selectMes.appendChild(opt);
            });

            selectMes.value = valorAtual;
        }

        function mudarAba(aba) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('conteudo-dashboard').classList.add('hidden');
            document.getElementById('conteudo-lancamentos').classList.add('hidden');
            document.getElementById('conteudo-imoveis').classList.add('hidden');

            document.getElementById(`tab-${aba}`).classList.add('active');
            document.getElementById(`conteudo-${aba}`).classList.remove('hidden');

            if (aba === 'dashboard') {
                atualizarKPIs();
            }
        }

        function aplicarFiltroGlobal() {
            const mesSel = document.getElementById('filter-global-mes').value;
            document.getElementById('print-filtro-periodo').innerText = mesSel ? formatarMesAnoExtenso(mesSel) : "Todos os Períodos";
            renderizarTabelaLancamentos();
            atualizarKPIs();
        }

        function limparFiltroPeriodo() {
            document.getElementById('filter-global-mes').value = '';
            aplicarFiltroGlobal();
        }

        // ================= GESTÃO DA ABA UNIFICADA "LANÇAMENTOS" =================
        function obterTodosLancamentos() {
            const listaUnificada = [];

            // Adiciona recebimentos
            dadosRecebimentos.forEach(r => {
                const total = (Number(r.valor) || 0) + (Number(r.despesaValor) || 0);
                listaUnificada.push({
                    idOrigem: r.id,
                    tipo: 'RECEBIMENTO',
                    titulo: r.imovel,
                    secundario: r.inquilino,
                    dataRef: r.vencimento,
                    dataPag: r.dataPagamento,
                    valor: total,
                    valorBase: r.valor,
                    despesaExtra: r.despesaValor,
                    despesaDesc: r.despesaDescricao,
                    status: statusEfetivo(r),
                    observacao: r.observacao,
                    raw: r
                });
            });

            // Adiciona despesas
            dadosDespesas.forEach(d => {
                listaUnificada.push({
                    idOrigem: d.id,
                    tipo: 'DESPESA',
                    titulo: d.descricao,
                    secundario: d.categoria,
                    imovelVinculado: d.imovel || 'Geral / Administração',
                    dataRef: d.data,
                    dataPag: d.data,
                    valor: Number(d.valor) || 0,
                    status: 'PAGO', // Despesas registradas são tratadas como executadas/pagas
                    observacao: d.observacao,
                    raw: d
                });
            });

            return listaUnificada;
        }

        function renderizarTabelaLancamentos() {
            const tbody = document.getElementById('tabela-lancamentos');
            const emptyState = document.getElementById('empty-state-lancamentos');
            const lista = obterDadosFiltradosLancamentos();

            tbody.innerHTML = '';
            document.getElementById('registro-lanc-count').innerText = `Exibindo ${lista.length} lançamentos`;

            if (lista.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            lista.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";

                const isRecebimento = item.tipo === 'RECEBIMENTO';
                
                // Badge Tipo
                const badgeTipo = isRecebimento
                    ? `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-arrow-down-left mr-1 my-auto"></i> Entrada</span>`
                    : `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><i class="fa-solid fa-arrow-up-right mr-1 my-auto"></i> Saída</span>`;

                // Badge Status
                let badgeStatusClass = item.status === 'PAGO' ? "bg-emerald-50 text-emerald-700" :
                                       item.status === 'PENDENTE' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";

                const valorClass = isRecebimento ? "text-emerald-600 font-bold" : "text-rose-600 font-bold";

                tr.innerHTML = `
                    <td class="py-3 px-4">${badgeTipo}</td>
                    <td class="py-3 px-4 font-medium text-slate-800">
                        ${escapeHtml(item.titulo)}
                        ${item.observacao ? `<p class="text-xs text-slate-400 font-normal"><i class="fa-regular fa-note-sticky mr-1"></i>${escapeHtml(item.observacao)}</p>` : ''}
                    </td>
                    <td class="py-3 px-4 text-slate-600">
                        ${escapeHtml(item.secundario)}
                        ${!isRecebimento && item.imovelVinculado ? `<p class="text-xs text-slate-400"><i class="fa-solid fa-house text-slate-300 mr-1"></i>${escapeHtml(item.imovelVinculado)}</p>` : ''}
                    </td>
                    <td class="py-3 px-4 text-slate-600">
                        ${formatarData(item.dataRef)}
                        ${item.dataPag && isRecebimento && item.status === 'PAGO' ? `<p class="text-xs text-emerald-600">Pago: ${formatarData(item.dataPag)}</p>` : ''}
                    </td>
                    <td class="py-3 px-4 ${valorClass}">
                        ${isRecebimento ? '+' : '-'} ${formatarMoeda(item.valor)}
                    </td>
                    <td class="py-3 px-4">
                        <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStatusClass}">${item.status}</span>
                    </td>
                    <td class="py-3 px-4 no-print text-right space-x-1">
                        ${isRecebimento && item.status !== 'PAGO' ? `<button onclick="marcarPago(${item.idOrigem})" class="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100" title="Marcar como pago"><i class="fa-solid fa-circle-check"></i></button>` : ''}
                        <button onclick="${isRecebimento ? 'editarRecebimento' : 'editarDespesa'}(${item.idOrigem})" class="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="${isRecebimento ? 'excluirRecebimento' : 'excluirDespesa'}(${item.idOrigem})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function obterDadosFiltradosLancamentos() {
            const busca = document.getElementById('search-input-lanc').value.toLowerCase();
            const tipoFiltro = document.getElementById('filter-tipo-lanc').value;
            const statusFiltro = document.getElementById('filter-status-lanc').value;
            const mesFiltro = document.getElementById('filter-global-mes').value;

            const todos = obterTodosLancamentos();

            return todos.filter(item => {
                const atendeBusca = item.titulo.toLowerCase().includes(busca) || 
                                     item.secundario.toLowerCase().includes(busca) || 
                                     (item.imovelVinculado && item.imovelVinculado.toLowerCase().includes(busca));
                
                const atendeTipo = tipoFiltro === 'TODOS' || item.tipo === tipoFiltro;
                const atendeStatus = statusFiltro === 'TODOS' || item.status === statusFiltro;
                const atendeMes = !mesFiltro || (item.dataRef && item.dataRef.startsWith(mesFiltro));

                return atendeBusca && atendeTipo && atendeStatus && atendeMes;
            }).sort((a, b) => new Date(b.dataRef) - new Date(a.dataRef));
        }

        function aplicarFiltrosLancamentos() {
            renderizarTabelaLancamentos();
        }

        // ================= GESTÃO DE DESPESAS =================
        function abrirModalDespesa(item = null) {
            const modal = document.getElementById('modal-despesa');
            const titulo = document.getElementById('modal-desp-titulo');

            if (item) {
                titulo.innerText = "Editar Despesa";
                document.getElementById('field-desp-id').value = item.id;
                document.getElementById('field-desp-descricao').value = item.descricao;
                document.getElementById('field-desp-valor').value = item.valor;
                document.getElementById('field-desp-data').value = item.data;
                document.getElementById('field-desp-categoria').value = item.categoria;
                document.getElementById('field-desp-imovel-select').value = item.imovel || 'Geral / Administração';
                document.getElementById('field-desp-observacao').value = item.observacao || '';
            } else {
                titulo.innerText = "Nova Despesa";
                document.getElementById('form-despesa').reset();
                document.getElementById('field-desp-id').value = '';
                document.getElementById('field-desp-data').value = hojeISO();
            }
            modal.classList.remove('hidden');
        }

        function fecharModalDespesa() {
            document.getElementById('modal-despesa').classList.add('hidden');
        }

        function salvarDespesa(e) {
            e.preventDefault();
            const id = document.getElementById('field-desp-id').value;
            const descricao = document.getElementById('field-desp-descricao').value;
            const valor = parseFloat(document.getElementById('field-desp-valor').value);
            const data = document.getElementById('field-desp-data').value;
            const categoria = document.getElementById('field-desp-categoria').value;
            const imovel = document.getElementById('field-desp-imovel-select').value;
            const observacao = document.getElementById('field-desp-observacao').value;

            if (id) {
                const idx = dadosDespesas.findIndex(i => i.id == id);
                if (idx !== -1) {
                    dadosDespesas[idx] = { id: Number(id), descricao, valor, data, categoria, imovel, observacao };
                }
            } else {
                const novoId = dadosDespesas.length > 0 ? Math.max(...dadosDespesas.map(i => i.id)) + 1 : 1;
                dadosDespesas.push({ id: novoId, descricao, valor, data, categoria, imovel, observacao });
            }

            salvarStorage();
            povoarSelectMeses();
            fecharModalDespesa();
            renderizarTabelaLancamentos();
            atualizarKPIs();
        }

        function editarDespesa(id) {
            const item = dadosDespesas.find(i => i.id === id);
            if (item) abrirModalDespesa(item);
        }

        function excluirDespesa(id) {
            if (confirm("Remover esta despesa?")) {
                dadosDespesas = dadosDespesas.filter(i => i.id !== id);
                salvarStorage();
                povoarSelectMeses();
                renderizarTabelaLancamentos();
                atualizarKPIs();
            }
        }

        // ================= GESTÃO DE RECEBIMENTOS =================
        function calcularTotalLancamento() {
            const valorAluguel = parseFloat(document.getElementById('field-rec-valor').value) || 0;
            const valorDespesa = parseFloat(document.getElementById('field-rec-despesa-valor').value) || 0;
            const total = valorAluguel + valorDespesa;
            document.getElementById('field-rec-total-display').innerText = formatarMoeda(total);
        }

        function abrirModalRecebimento(item = null) {
            const modal = document.getElementById('modal-recebimento');
            const titulo = document.getElementById('modal-rec-titulo');

            if (item) {
                titulo.innerText = "Editar Recebimento";
                document.getElementById('field-rec-id').value = item.id;
                document.getElementById('field-rec-imovel').value = item.imovel;
                document.getElementById('field-rec-inquilino').value = item.inquilino;
                document.getElementById('field-rec-valor').value = item.valor;
                document.getElementById('field-rec-despesa-valor').value = item.despesaValor || '';
                document.getElementById('field-rec-despesa-desc').value = item.despesaDescricao || '';
                document.getElementById('field-rec-vencimento').value = item.vencimento;
                document.getElementById('field-rec-status').value = item.status;
                document.getElementById('field-rec-dataPagamento').value = item.dataPagamento || '';
                document.getElementById('field-rec-observacao').value = item.observacao || '';
            } else {
                titulo.innerText = "Novo Recebimento";
                document.getElementById('form-recebimento').reset();
                document.getElementById('field-rec-id').value = '';
                document.getElementById('field-rec-vencimento').value = hojeISO();
            }
            calcularTotalLancamento();
            modal.classList.remove('hidden');
        }

        function fecharModalRecebimento() {
            document.getElementById('modal-recebimento').classList.add('hidden');
        }

        function ajustarDataPagamento() {
            const status = document.getElementById('field-rec-status').value;
            const campoData = document.getElementById('field-rec-dataPagamento');
            if (status === 'PAGO' && !campoData.value) {
                campoData.value = hojeISO();
            } else if (status !== 'PAGO') {
                campoData.value = '';
            }
        }

        function salvarRecebimento(e) {
            e.preventDefault();
            const id = document.getElementById('field-rec-id').value;
            const imovel = document.getElementById('field-rec-imovel').value;
            const inquilino = document.getElementById('field-rec-inquilino').value;
            const valor = parseFloat(document.getElementById('field-rec-valor').value);
            const despesaValor = parseFloat(document.getElementById('field-rec-despesa-valor').value) || 0;
            const despesaDescricao = document.getElementById('field-rec-despesa-desc').value;
            const vencimento = document.getElementById('field-rec-vencimento').value;
            const status = document.getElementById('field-rec-status').value;
            const dataPagamento = document.getElementById('field-rec-dataPagamento').value;
            const observacao = document.getElementById('field-rec-observacao').value;

            if (id) {
                const idx = dadosRecebimentos.findIndex(i => i.id == id);
                if (idx !== -1) {
                    dadosRecebimentos[idx] = { id: Number(id), imovel, inquilino, valor, despesaValor, despesaDescricao, vencimento, status, dataPagamento, observacao };
                }
            } else {
                const novoId = dadosRecebimentos.length > 0 ? Math.max(...dadosRecebimentos.map(i => i.id)) + 1 : 1;
                dadosRecebimentos.push({ id: novoId, imovel, inquilino, valor, despesaValor, despesaDescricao, vencimento, status, dataPagamento, observacao });
            }

            salvarStorage();
            povoarSelectMeses();
            fecharModalRecebimento();
            renderizarTabelaLancamentos();
            atualizarKPIs();
        }

        function editarRecebimento(id) {
            const item = dadosRecebimentos.find(i => i.id === id);
            if (item) abrirModalRecebimento(item);
        }

        function excluirRecebimento(id) {
            if (confirm("Remover este registro de recebimento?")) {
                dadosRecebimentos = dadosRecebimentos.filter(i => i.id !== id);
                salvarStorage();
                povoarSelectMeses();
                renderizarTabelaLancamentos();
                atualizarKPIs();
            }
        }

        // ================= GESTÃO DE IMÓVEIS =================
        function renderizarImoveis() {
            const grid = document.getElementById('grid-imoveis');
            const emptyState = document.getElementById('empty-state-imoveis');

            grid.innerHTML = '';

            if (dadosImoveis.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            dadosImoveis.forEach(imovel => {
                const card = document.createElement('div');
                card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-brand-500 transition-all";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-slate-800 text-base">${escapeHtml(imovel.nome)}</h3>
                            <span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold">Dia ${imovel.diaVencimento}</span>
                        </div>
                        <p class="text-xs text-slate-500 mb-3"><i class="fa-solid fa-location-dot mr-1 text-slate-400"></i>${escapeHtml(imovel.endereco || 'Endereço não informado')}</p>
                        <div class="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
                            <p class="text-slate-600"><span class="font-semibold text-slate-700">Inquilino:</span> ${escapeHtml(imovel.inquilino || 'Não atribuído')}</p>
                            <p class="text-slate-600"><span class="font-semibold text-slate-700">Aluguel Base:</span> <span class="font-bold text-brand-700">${formatarMoeda(imovel.valorBase)}</span></p>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                        <button onclick="editarImovel(${imovel.id})" class="px-2.5 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded-lg transition-colors font-medium"><i class="fa-solid fa-pen mr-1"></i>Editar</button>
                        <button onclick="excluirImovel(${imovel.id})" class="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium"><i class="fa-solid fa-trash mr-1"></i>Excluir</button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function atualizarDropdownsImoveis() {
            const selectRec = document.getElementById('field-rec-imovel-select');
            const selectDesp = document.getElementById('field-desp-imovel-select');

            selectRec.innerHTML = '<option value="">-- Selecione para preencher --</option>';
            selectDesp.innerHTML = '<option value="Geral / Administração">Geral / Administração</option>';

            dadosImoveis.forEach(imovel => {
                const opt1 = document.createElement('option');
                opt1.value = imovel.id;
                opt1.innerText = `${imovel.nome} (${formatarMoeda(imovel.valorBase)})`;
                selectRec.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = imovel.nome;
                opt2.innerText = imovel.nome;
                selectDesp.appendChild(opt2);
            });
        }

        function abrirModalImovel(imovel = null) {
            const modal = document.getElementById('modal-imovel');
            const titulo = document.getElementById('modal-imovel-titulo');

            if (imovel) {
                titulo.innerText = "Editar Imóvel";
                document.getElementById('field-imovel-id').value = imovel.id;
                document.getElementById('field-imovel-nome').value = imovel.nome;
                document.getElementById('field-imovel-endereco').value = imovel.endereco || '';
                document.getElementById('field-imovel-inquilino').value = imovel.inquilino || '';
                document.getElementById('field-imovel-valor').value = imovel.valorBase;
                document.getElementById('field-imovel-dia').value = imovel.diaVencimento;
            } else {
                titulo.innerText = "Cadastrar Imóvel";
                document.getElementById('form-imovel').reset();
                document.getElementById('field-imovel-id').value = '';
            }
            modal.classList.remove('hidden');
        }

        function fecharModalImovel() {
            document.getElementById('modal-imovel').classList.add('hidden');
        }

        function salvarImovel(e) {
            e.preventDefault();
            const id = document.getElementById('field-imovel-id').value;
            const nome = document.getElementById('field-imovel-nome').value;
            const endereco = document.getElementById('field-imovel-endereco').value;
            const inquilino = document.getElementById('field-imovel-inquilino').value;
            const valorBase = parseFloat(document.getElementById('field-imovel-valor').value);
            const diaVencimento = parseInt(document.getElementById('field-imovel-dia').value);

            if (id) {
                const idx = dadosImoveis.findIndex(i => i.id == id);
                if (idx !== -1) {
                    dadosImoveis[idx] = { id: Number(id), nome, endereco, inquilino, valorBase, diaVencimento };
                }
            } else {
                const novoId = dadosImoveis.length > 0 ? Math.max(...dadosImoveis.map(i => i.id)) + 1 : 1;
                dadosImoveis.push({ id: novoId, nome, endereco, inquilino, valorBase, diaVencimento });
            }

            salvarStorage();
            fecharModalImovel();
            renderizarImoveis();
            atualizarDropdownsImoveis();
            atualizarKPIs();
        }

        function editarImovel(id) {
            const item = dadosImoveis.find(i => i.id === id);
            if (item) abrirModalImovel(item);
        }

        function excluirImovel(id) {
            if (confirm("Remover este imóvel?")) {
                dadosImoveis = dadosImoveis.filter(i => i.id !== id);
                salvarStorage();
                renderizarImoveis();
                atualizarDropdownsImoveis();
                atualizarKPIs();
            }
        }

        function autopreencherImovel() {
            const imovelId = document.getElementById('field-rec-imovel-select').value;
            if (!imovelId) return;

            const imovel = dadosImoveis.find(i => i.id == imovelId);
            if (imovel) {
                document.getElementById('field-rec-imovel').value = imovel.nome;
                document.getElementById('field-rec-inquilino').value = imovel.inquilino || '';
                document.getElementById('field-rec-valor').value = imovel.valorBase;

                const hoje = new Date();
                const ano = hoje.getFullYear();
                const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                const dia = String(imovel.diaVencimento).padStart(2, '0');
                document.getElementById('field-rec-vencimento').value = `${ano}-${mes}-${dia}`;
                calcularTotalLancamento();
            }
        }

        // ================= DASHBOARD & KPIS =================
        function atualizarKPIs() {
            const mesSel = document.getElementById('filter-global-mes').value;

            const recsFiltrados = dadosRecebimentos.filter(item => !mesSel || (item.vencimento && item.vencimento.startsWith(mesSel)));
            const despsFiltradas = dadosDespesas.filter(item => !mesSel || (item.data && item.data.startsWith(mesSel)));

            const totalRecebido = recsFiltrados
                .filter(i => i.status === 'PAGO')
                .reduce((acc, curr) => acc + Number(curr.valor || 0) + Number(curr.despesaValor || 0), 0);

            const totalDespesas = despsFiltradas
                .reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

            const saldoLiquido = totalRecebido - totalDespesas;

            const pendenteValores = recsFiltrados
                .filter(i => i.status === 'PENDENTE' || i.status === 'ATRASADO')
                .reduce((acc, curr) => acc + Number(curr.valor || 0) + Number(curr.despesaValor || 0), 0);

            const pendenteCount = recsFiltrados.filter(i => i.status === 'PENDENTE' || i.status === 'ATRASADO').length;
            const totalPrevisto = recsFiltrados.reduce((acc, curr) => acc + Number(curr.valor || 0) + Number(curr.despesaValor || 0), 0);
            const taxaAdimplencia = totalPrevisto > 0 ? ((totalRecebido / totalPrevisto) * 100).toFixed(1) : 0;

            document.getElementById('kpi-recebido').innerText = formatarMoeda(totalRecebido);
            document.getElementById('kpi-despesas').innerText = formatarMoeda(totalDespesas);
            document.getElementById('kpi-saldo-liquido').innerText = formatarMoeda(saldoLiquido);

            const saldoEl = document.getElementById('kpi-saldo-liquido');
            if (saldoLiquido < 0) {
                saldoEl.className = "text-2xl font-bold text-rose-600 mt-1";
            } else {
                saldoEl.className = "text-2xl font-bold text-emerald-600 mt-1";
            }

            document.getElementById('kpi-pendente').innerText = formatarMoeda(pendenteValores);
            document.getElementById('kpi-pendente-count').innerText = `${pendenteCount} pendente(s)`;
            document.getElementById('kpi-imoveis-count').innerText = dadosImoveis.length;
            document.getElementById('kpi-adimplencia').innerText = `${taxaAdimplencia}%`;
            atualizarSaldoConta();

            prepararTabelaImpressao(recsFiltrados, despsFiltradas, totalRecebido, totalDespesas, saldoLiquido);
            atualizarGraficos();
        }

        function prepararTabelaImpressao(recs, desps, totEntradas, totSaidas, saldo) {
            document.getElementById('print-total-entradas').innerText = formatarMoeda(totEntradas);
            document.getElementById('print-total-saidas').innerText = formatarMoeda(totSaidas);
            document.getElementById('print-saldo-liquido').innerText = formatarMoeda(saldo);

            const tbEntradas = document.getElementById('print-tabela-entradas');
            tbEntradas.innerHTML = '';
            recs.filter(i => i.status === 'PAGO').forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "border-b";
                tr.innerHTML = `
                    <td class="p-2">${escapeHtml(item.imovel)}</td>
                    <td class="p-2">${escapeHtml(item.inquilino)}</td>
                    <td class="p-2">${formatarData(item.dataPagamento)}</td>
                    <td class="p-2 font-bold">${formatarMoeda(Number(item.valor || 0) + Number(item.despesaValor || 0))}</td>
                `;
                tbEntradas.appendChild(tr);
            });

            const tbSaidas = document.getElementById('print-tabela-saidas');
            tbSaidas.innerHTML = '';
            desps.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "border-b";
                tr.innerHTML = `
                    <td class="p-2">${escapeHtml(item.descricao)}</td>
                    <td class="p-2">${escapeHtml(item.categoria)}</td>
                    <td class="p-2">${escapeHtml(item.imovel || 'Geral')}</td>
                    <td class="p-2">${formatarData(item.data)}</td>
                    <td class="p-2 font-bold text-rose-700">${formatarMoeda(item.valor)}</td>
                `;
                tbSaidas.appendChild(tr);
            });
        }

        function inicializarGraficos() {
            const ctxMensal = document.getElementById('chartMensal').getContext('2d');
            chartMensalInstance = new Chart(ctxMensal, {
                type: 'bar',
                data: obterDadosGraficoMensal(),
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });

            const ctxCat = document.getElementById('chartCategoriasDespesa').getContext('2d');
            chartCategoriasInstance = new Chart(ctxCat, {
                type: 'doughnut',
                data: obterDadosGraficoCategorias(),
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        function atualizarGraficos() {
            if (chartMensalInstance && chartCategoriasInstance) {
                chartMensalInstance.data = obterDadosGraficoMensal();
                chartMensalInstance.update();
                chartCategoriasInstance.data = obterDadosGraficoCategorias();
                chartCategoriasInstance.update();
            }
        }

        function obterDadosGraficoMensal() {
            const mesesMap = {};

            dadosRecebimentos.forEach(item => {
                if (item.status === 'PAGO' && item.dataPagamento) {
                    const chave = item.dataPagamento.substring(0, 7);
                    if (!mesesMap[chave]) mesesMap[chave] = { receita: 0, despesa: 0 };
                    mesesMap[chave].receita += (Number(item.valor || 0) + Number(item.despesaValor || 0));
                }
            });

            dadosDespesas.forEach(item => {
                if (item.data) {
                    const chave = item.data.substring(0, 7);
                    if (!mesesMap[chave]) mesesMap[chave] = { receita: 0, despesa: 0 };
                    mesesMap[chave].despesa += Number(item.valor || 0);
                }
            });

            const chavesOrdenadas = Object.keys(mesesMap).sort();
            const labels = chavesOrdenadas.map(c => formatarMesAnoExtenso(c));
            const receitas = chavesOrdenadas.map(c => mesesMap[c].receita);
            const despesas = chavesOrdenadas.map(c => mesesMap[c].despesa);

            return {
                labels: labels.length > 0 ? labels : ['Sem dados'],
                datasets: [
                    { label: 'Receitas (R$)', data: receitas.length > 0 ? receitas : [0], backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Despesas (R$)', data: despesas.length > 0 ? despesas : [0], backgroundColor: '#f43f5e', borderRadius: 4 }
                ]
            };
        }

        function obterDadosGraficoCategorias() {
            const catMap = {};
            dadosDespesas.forEach(item => {
                const cat = item.categoria || 'Outros';
                catMap[cat] = (catMap[cat] || 0) + Number(item.valor || 0);
            });

            const labels = Object.keys(catMap);
            const valores = Object.values(catMap);

            return {
                labels: labels.length > 0 ? labels : ['Sem despesas'],
                datasets: [{
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: ['#f43f5e', '#3b82f6', '#eab308', '#8b5cf6', '#64748b']
                }]
            };
        }

        // ================= BACKUP & EXPORTAÇÕES =================
        function exportarBackupJSON() {
            const dadosBackup = {
                versao: '4.0',
                ajustesSaldo: dadosAjustes,
                dataExportacao: new Date().toISOString(),
                imoveis: dadosImoveis,
                recebimentos: dadosRecebimentos,
                despesas: dadosDespesas
            };

            baixarArquivo(new Blob([JSON.stringify(dadosBackup, null, 2)], { type: 'application/json' }), `gestao_de_imoveis_${hojeISO()}.json`);
        }

        function importarBackupJSON(event) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const conteudo = JSON.parse(e.target.result);
                    if (conteudo.imoveis && conteudo.recebimentos) {
                        dadosImoveis = conteudo.imoveis;
                        dadosRecebimentos = conteudo.recebimentos;
                        dadosDespesas = conteudo.despesas || [];
                        dadosAjustes = conteudo.ajustesSaldo || [];
                        salvarStorage();
                        povoarSelectMeses();
                        renderizarImoveis();
                        atualizarDropdownsImoveis();
                        renderizarTabelaLancamentos();
                        atualizarKPIs();
                        alert("Backup carregado com sucesso!");
                    } else {
                        alert("Arquivo de backup inválido.");
                    }
                } catch (err) {
                    alert("Erro ao ler o arquivo JSON de backup.");
                }
            };
            const arquivo = event.target.files[0];
            if (arquivo) reader.readAsText(arquivo);
            event.target.value = ''; // permite escolher o mesmo arquivo de novo
        }

        function exportarCSVLancamentos() {
            let csv = "data:text/csv;charset=utf-8,\uFEFFTipo;Descricao/Imovel;Inquilino/Categoria;Data/Vencimento;Valor;Status;Observacao\n";
            const lancamentos = obterDadosFiltradosLancamentos();
            
            lancamentos.forEach(item => {
                csv += `"${item.tipo}";"${item.titulo}";"${item.secundario}";${item.dataRef};${String(item.valor).replace('.', ',')};"${item.status}";"${item.observacao || ''}"\n`;
            });
            downloadCSV(csv, `lancamentos_${hojeISO()}.csv`);
        }

        function downloadCSV(csvContent, fileName) {
            const texto = csvContent.replace(/^data:text\/csv;charset=utf-8,/, '');
            baixarArquivo(new Blob([texto], { type: 'text/csv;charset=utf-8' }), fileName);
        }

        // Download compatível com o app instalado no Android (Blob em vez de data: URI)
        function baixarArquivo(blob, nome) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = nome;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }

        function carregarExemploInicial() {
            carregarExemploImoveis();
            carregarExemploDespesas();
            dadosRecebimentos = [
                { id: 1, imovel: "Apto 101 - Ed. Solar", inquilino: "Ana Beatriz Souza", valor: 2200, despesaValor: 150, despesaDescricao: "Taxa extraordinária", vencimento: "2026-10-05", dataPagamento: "2026-10-04", status: "PAGO", observacao: "PIX" },
                { id: 2, imovel: "Casa 04 - Res. Primavera", inquilino: "Roberto Silva", valor: 3500, despesaValor: 0, despesaDescricao: "", vencimento: "2026-10-10", dataPagamento: "2026-10-10", status: "PAGO", observacao: "" },
                { id: 3, imovel: "Sala 305 - Trade Center", inquilino: "Tech Solutions", valor: 1800, despesaValor: 0, despesaDescricao: "", vencimento: "2026-10-15", dataPagamento: "", status: "PENDENTE", observacao: "" }
            ];
            salvarStorage();
        }

        function carregarExemploImoveis() {
            dadosImoveis = [
                { id: 1, nome: "Apto 101 - Ed. Solar", endereco: "Rua das Flores, 123", inquilino: "Ana Beatriz Souza", valorBase: 2200, diaVencimento: 5 },
                { id: 2, nome: "Casa 04 - Res. Primavera", endereco: "Av. Principal, 45", inquilino: "Roberto Silva", valorBase: 3500, diaVencimento: 10 },
                { id: 3, nome: "Sala 305 - Trade Center", endereco: "Rua Central, 800", inquilino: "Tech Solutions", valorBase: 1800, diaVencimento: 15 }
            ];
            salvarStorage();
        }

        function carregarExemploDespesas() {
            dadosDespesas = [
                { id: 1, descricao: "Conserto de vazamento no banheiro", valor: 350, data: "2026-10-08", categoria: "Manutenção", imovel: "Apto 101 - Ed. Solar", observacao: "Encanador João" },
                { id: 2, descricao: "IPTU Cota Única / Mensal", valor: 280, data: "2026-10-12", categoria: "IPTU / Impostos", imovel: "Casa 04 - Res. Primavera", observacao: "" },
                { id: 3, descricao: "Honorários de Administração Imobiliária", valor: 400, data: "2026-10-15", categoria: "Taxa de Administração", imovel: "Geral / Administração", observacao: "" }
            ];
            salvarStorage();
        }

        function carregarDadosExemplo() {
            if (confirm("Deseja carregar os dados de exemplo no seu banco local?")) {
                carregarExemploInicial();
                povoarSelectMeses();
                renderizarImoveis();
                atualizarDropdownsImoveis();
                renderizarTabelaLancamentos();
                atualizarKPIs();
            }
        }

        function resetarBanco() {
            if (confirm("ATENÇÃO: Deseja apagar todos os imóveis, despesas e recebimentos? Faça um backup antes!")) {
                dadosRecebimentos = [];
                dadosDespesas = [];
                dadosImoveis = [];
                dadosAjustes = [];
                salvarStorage();
                povoarSelectMeses();
                renderizarImoveis();
                atualizarDropdownsImoveis();
                renderizarTabelaLancamentos();
                atualizarKPIs();
            }
        }

        function imprimirRelatorio() {
            window.print();
        }

        function formatarMoeda(v) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
        }

        function formatarData(d) {
            if (!d) return '';
            const p = d.split('-');
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
        }

        function formatarMesAnoExtenso(anoMes) {
            if (!anoMes) return '';
            const [ano, mes] = anoMes.split('-');
            const data = new Date(parseInt(ano), parseInt(mes) - 1, 1);
            return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }

        function escapeHtml(str) {
            return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        }
    
        // ================= DATAS / STATUS =================
        function hojeISO() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function statusEfetivo(r) {
            return (r.status === 'PENDENTE' && r.vencimento && r.vencimento < hojeISO()) ? 'ATRASADO' : r.status;
        }

        function atualizarTudo() {
            salvarStorage();
            povoarSelectMeses();
            renderizarImoveis();
            atualizarDropdownsImoveis();
            renderizarTabelaLancamentos();
            atualizarKPIs();
        }

        function marcarPago(id) {
            const r = dadosRecebimentos.find(i => i.id === id);
            if (!r) return;
            r.status = 'PAGO';
            if (!r.dataPagamento) r.dataPagamento = hojeISO();
            atualizarTudo();
        }

        function gerarCobrancasMes() {
            if (dadosImoveis.length === 0) { alert('Cadastre ao menos um imóvel.'); return; }
            const mes = prompt('Gerar cobranças para qual mês? (AAAA-MM)', hojeISO().substring(0, 7));
            if (!mes) return;
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { alert('Formato inválido. Use AAAA-MM, ex: 2026-11'); return; }
            const [ano, m] = mes.split('-').map(Number);
            const ultimoDia = new Date(ano, m, 0).getDate();
            let criados = 0;
            dadosImoveis.forEach(im => {
                const existe = dadosRecebimentos.some(r => r.imovel === im.nome && r.vencimento && r.vencimento.startsWith(mes));
                if (existe) return;
                const dia = String(Math.min(Number(im.diaVencimento) || 1, ultimoDia)).padStart(2, '0');
                const novoId = dadosRecebimentos.length ? Math.max(...dadosRecebimentos.map(i => i.id)) + 1 : 1;
                dadosRecebimentos.push({ id: novoId, imovel: im.nome, inquilino: im.inquilino || '', valor: Number(im.valorBase) || 0, despesaValor: 0, despesaDescricao: '', vencimento: `${mes}-${dia}`, dataPagamento: '', status: 'PENDENTE', observacao: 'Gerado automaticamente' });
                criados++;
            });
            atualizarTudo();
            alert(criados ? `${criados} cobrança(s) criada(s) para ${formatarMesAnoExtenso(mes)}.` : 'Todos os imóveis já possuem cobrança neste mês.');
        }

        // ================= SALDO DA CONTA BANCÁRIA =================
        function saldoCalculado() {
            const entradas = dadosRecebimentos.filter(r => r.status === 'PAGO')
                .reduce((a, r) => a + Number(r.valor || 0) + Number(r.despesaValor || 0), 0);
            const saidas = dadosDespesas.reduce((a, d) => a + Number(d.valor || 0), 0);
            return entradas - saidas;
        }

        function saldoConta() {
            return saldoCalculado() + dadosAjustes.reduce((a, j) => a + Number(j.valor || 0), 0);
        }

        function atualizarSaldoConta() {
            const el = document.getElementById('kpi-conta');
            const saldo = saldoConta();
            el.innerText = formatarMoeda(saldo);
            el.className = 'text-3xl font-bold mt-1 ' + (saldo < 0 ? 'text-rose-400' : 'text-white');
            const ult = dadosAjustes.length ? dadosAjustes[dadosAjustes.length - 1] : null;
            document.getElementById('kpi-conta-info').innerText = ult
                ? `Última conferência com o banco: ${formatarData(ult.data)} (todo o histórico, independe do filtro de mês)`
                : 'Nenhum ajuste manual feito ainda. Valor = recebimentos pagos − despesas.';
        }

        function abrirModalSaldo() {
            document.getElementById('saldo-sistema-display').innerText = formatarMoeda(saldoConta());
            document.getElementById('field-saldo-real').value = '';
            document.getElementById('field-saldo-data').value = hojeISO();
            document.getElementById('field-saldo-obs').value = '';
            previewDiferenca();
            renderizarAjustes();
            document.getElementById('modal-saldo').classList.remove('hidden');
        }

        function fecharModalSaldo() {
            document.getElementById('modal-saldo').classList.add('hidden');
        }

        function previewDiferenca() {
            const v = document.getElementById('field-saldo-real').value;
            const el = document.getElementById('saldo-diferenca-display');
            if (v === '') { el.innerText = 'R$ 0,00'; el.className = 'font-bold text-slate-800'; return; }
            const dif = Math.round((parseFloat(v) - saldoConta()) * 100) / 100;
            el.innerText = (dif > 0 ? '+ ' : '') + formatarMoeda(dif);
            el.className = 'font-bold ' + (dif > 0 ? 'text-emerald-600' : dif < 0 ? 'text-rose-600' : 'text-slate-800');
        }

        function salvarAjusteSaldo(e) {
            e.preventDefault();
            const real = parseFloat(document.getElementById('field-saldo-real').value);
            if (isNaN(real)) return;
            const anterior = saldoConta();
            const dif = Math.round((real - anterior) * 100) / 100;
            if (dif === 0) { alert('O saldo do sistema já é igual ao saldo informado. Nenhum ajuste necessário.'); return; }
            const id = dadosAjustes.length ? Math.max(...dadosAjustes.map(a => a.id)) + 1 : 1;
            dadosAjustes.push({
                id, data: document.getElementById('field-saldo-data').value,
                saldoAnterior: anterior, saldoReal: real, valor: dif,
                observacao: document.getElementById('field-saldo-obs').value
            });
            salvarStorage();
            atualizarSaldoConta();
            fecharModalSaldo();
        }

        function renderizarAjustes() {
            const box = document.getElementById('lista-ajustes');
            if (!dadosAjustes.length) { box.innerHTML = '<p class="text-xs text-slate-400">Nenhum ajuste registrado.</p>'; return; }
            box.innerHTML = [...dadosAjustes].reverse().map(a => `
                <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <div>
                        <p class="font-semibold text-slate-700">${formatarData(a.data)} · saldo real ${formatarMoeda(a.saldoReal)}</p>
                        <p class="text-slate-500">${a.observacao ? escapeHtml(a.observacao) : 'Sem observação'}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold ${a.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${a.valor > 0 ? '+' : ''}${formatarMoeda(a.valor)}</span>
                        <button type="button" onclick="excluirAjuste(${a.id})" class="text-slate-400 hover:text-rose-600" title="Remover ajuste"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>`).join('');
        }

        function excluirAjuste(id) {
            if (!confirm('Remover este ajuste? O saldo voltará ao valor anterior a ele.')) return;
            dadosAjustes = dadosAjustes.filter(a => a.id !== id);
            salvarStorage();
            atualizarSaldoConta();
            document.getElementById('saldo-sistema-display').innerText = formatarMoeda(saldoConta());
            previewDiferenca();
            renderizarAjustes();
        }

        // ESC fecha qualquer modal aberto; clique no fundo escuro também
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') document.querySelectorAll('div[id^="modal-"]').forEach(m => m.classList.add('hidden'));
        });
        document.addEventListener('mousedown', e => {
            if (e.target.matches && e.target.matches('div[id^="modal-"]')) e.target.classList.add('hidden');
        });
    

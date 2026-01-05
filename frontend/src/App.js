import React, { useState, useEffect } from 'react';
import { PlusCircle, ShoppingCart, DollarSign, Wrench, BarChart3, Package, Trash2, Edit2, Check, X } from 'lucide-react';

const FinanceApp = () => {
  const [activeTab, setActiveTab] = useState('compras');
  const [compras, setCompras] = useState([]);
  const [contas, setContas] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  // Estados para formulários
  const [novaCompra, setNovaCompra] = useState({ item: '', quantidade: '', valor: '', mes: new Date().toISOString().slice(0, 7) });
  const [novaConta, setNovaConta] = useState({ tipo: 'Água', valor: '', mes: new Date().toISOString().slice(0, 7) });
  const [novaManutencao, setNovaManutencao] = useState({ descricao: '', valor: '', data: new Date().toISOString().slice(0, 10) });
  const [mesRelatorio, setMesRelatorio] = useState(new Date().toISOString().slice(0, 7));
  const [mesFiltroCompras, setMesFiltroCompras] = useState(new Date().toISOString().slice(0, 7));
  const [mesFiltroContas, setMesFiltroContas] = useState(new Date().toISOString().slice(0, 7));
  const [mesFiltroManutencoes, setMesFiltroManutencoes] = useState(new Date().toISOString().slice(0, 7));

  // Carregar dados
  useEffect(() => {
    const savedCompras = JSON.parse(localStorage.getItem('compras') || '[]');
    const savedContas = JSON.parse(localStorage.getItem('contas') || '[]');
    const savedManutencoes = JSON.parse(localStorage.getItem('manutencoes') || '[]');
    const savedEstoque = JSON.parse(localStorage.getItem('estoque') || '[]');
    
    setCompras(savedCompras);
    setContas(savedContas);
    setManutencoes(savedManutencoes);
    setEstoque(savedEstoque);
  }, []);

  // Salvar dados
  const salvarCompras = (dados) => {
    setCompras(dados);
    localStorage.setItem('compras', JSON.stringify(dados));
  };

  const salvarContas = (dados) => {
    setContas(dados);
    localStorage.setItem('contas', JSON.stringify(dados));
  };

  const salvarManutencoes = (dados) => {
    setManutencoes(dados);
    localStorage.setItem('manutencoes', JSON.stringify(dados));
  };

  const salvarEstoque = (dados) => {
    setEstoque(dados);
    localStorage.setItem('estoque', JSON.stringify(dados));
  };

  // Adicionar compra
  const adicionarCompra = () => {
    if (novaCompra.item && novaCompra.quantidade && novaCompra.valor) {
      const compra = {
        id: Date.now(),
        ...novaCompra,
        valor: parseFloat(novaCompra.valor),
        quantidade: parseFloat(novaCompra.quantidade)
      };
      salvarCompras([...compras, compra]);
      
      // Adicionar ao estoque
      const itemEstoque = estoque.find(e => e.item.toLowerCase() === novaCompra.item.toLowerCase());
      if (itemEstoque) {
        salvarEstoque(estoque.map(e => 
          e.item.toLowerCase() === novaCompra.item.toLowerCase() 
            ? { ...e, quantidade: e.quantidade + parseFloat(novaCompra.quantidade) }
            : e
        ));
      } else {
        salvarEstoque([...estoque, { 
          id: Date.now(), 
          item: novaCompra.item, 
          quantidade: parseFloat(novaCompra.quantidade) 
        }]);
      }
      
      setNovaCompra({ item: '', quantidade: '', valor: '', mes: new Date().toISOString().slice(0, 7) });
    }
  };

  // Adicionar conta
  const adicionarConta = () => {
    if (novaConta.valor) {
      salvarContas([...contas, { id: Date.now(), ...novaConta, valor: parseFloat(novaConta.valor) }]);
      setNovaConta({ tipo: 'Água', valor: '', mes: new Date().toISOString().slice(0, 7) });
    }
  };

  // Adicionar manutenção
  const adicionarManutencao = () => {
    if (novaManutencao.descricao && novaManutencao.valor) {
      salvarManutencoes([...manutencoes, { id: Date.now(), ...novaManutencao, valor: parseFloat(novaManutencao.valor) }]);
      setNovaManutencao({ descricao: '', valor: '', data: new Date().toISOString().slice(0, 10) });
    }
  };

  // Dar baixa no estoque
  const darBaixaEstoque = (id, quantidade) => {
    const item = estoque.find(e => e.id === id);
    if (item && quantidade <= item.quantidade) {
      salvarEstoque(estoque.map(e => 
        e.id === id ? { ...e, quantidade: e.quantidade - quantidade } : e
      ).filter(e => e.quantidade > 0));
    }
  };

  // Excluir itens
  const excluirCompra = (id) => salvarCompras(compras.filter(c => c.id !== id));
  const excluirConta = (id) => salvarContas(contas.filter(c => c.id !== id));
  const excluirManutencao = (id) => salvarManutencoes(manutencoes.filter(m => m.id !== id));

  // Calcular totais para relatório
  const calcularRelatorio = () => {
    const comprasMes = compras.filter(c => c.mes === mesRelatorio);
    const contasMes = contas.filter(c => c.mes === mesRelatorio);
    const manutencoesMes = manutencoes.filter(m => m.data.slice(0, 7) === mesRelatorio);

    const totalCompras = comprasMes.reduce((acc, c) => acc + c.valor, 0);
    const totalContas = contasMes.reduce((acc, c) => acc + c.valor, 0);
    const totalManutencoes = manutencoesMes.reduce((acc, m) => acc + m.valor, 0);
    const totalGeral = totalCompras + totalContas + totalManutencoes;

    const contasPorTipo = contas
      .filter(c => c.mes === mesRelatorio)
      .reduce((acc, c) => {
        acc[c.tipo] = (acc[c.tipo] || 0) + c.valor;
        return acc;
      }, {});

    return { totalCompras, totalContas, totalManutencoes, totalGeral, contasPorTipo, comprasMes, contasMes, manutencoesMes };
  };

  const relatorio = calcularRelatorio();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-indigo-900 mb-8 text-center">Controle de Contas Domésticas</h1>
        
        {/* Menu de navegação */}
        <div className="bg-white rounded-lg shadow-lg mb-6 p-2 flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('compras')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'compras' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <ShoppingCart size={20} /> Compras do Mês
          </button>
          <button onClick={() => setActiveTab('contas')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'contas' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <DollarSign size={20} /> Contas Fixas
          </button>
          <button onClick={() => setActiveTab('manutencoes')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'manutencoes' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Wrench size={20} /> Manutenções
          </button>
          <button onClick={() => setActiveTab('estoque')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'estoque' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Package size={20} /> Estoque
          </button>
          <button onClick={() => setActiveTab('relatorios')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${activeTab === 'relatorios' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <BarChart3 size={20} /> Relatórios
          </button>
        </div>

        {/* Conteúdo das abas */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          
          {/* Aba Compras */}
          {activeTab === 'compras' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Lista de Compras do Mês</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <input type="text" placeholder="Item (arroz, feijão...)" value={novaCompra.item} onChange={(e) => setNovaCompra({...novaCompra, item: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="number" placeholder="Quantidade" value={novaCompra.quantidade} onChange={(e) => setNovaCompra({...novaCompra, quantidade: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="number" placeholder="Valor (R$)" value={novaCompra.valor} onChange={(e) => setNovaCompra({...novaCompra, valor: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="month" value={novaCompra.mes} onChange={(e) => setNovaCompra({...novaCompra, mes: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <button onClick={adicionarCompra} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                  <PlusCircle size={20} /> Adicionar
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Filtrar por Mês:</label>
                <input type="month" value={mesFiltroCompras} onChange={(e) => setMesFiltroCompras(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Quantidade</th>
                      <th className="px-4 py-2 text-left">Valor</th>
                      <th className="px-4 py-2 text-left">Mês</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.filter(c => c.mes === mesFiltroCompras).map(c => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{c.item}</td>
                        <td className="px-4 py-2">{c.quantidade}</td>
                        <td className="px-4 py-2">R$ {c.valor.toFixed(2)}</td>
                        <td className="px-4 py-2">{c.mes}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => excluirCompra(c.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {compras.filter(c => c.mes === mesFiltroCompras).length === 0 && (
                  <p className="text-center text-gray-500 mt-4">Nenhuma compra registrada para este mês</p>
                )}
              </div>
            </div>
          )}

          {/* Aba Contas */}
          {activeTab === 'contas' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Contas Fixas</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <select value={novaConta.tipo} onChange={(e) => setNovaConta({...novaConta, tipo: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option>Água</option>
                  <option>Luz</option>
                  <option>Telefone</option>
                  <option>Gás</option>
                  <option>Internet</option>
                  <option>Condomínio</option>
                  <option>Outros</option>
                </select>
                <input type="number" placeholder="Valor (R$)" value={novaConta.valor} onChange={(e) => setNovaConta({...novaConta, valor: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="month" value={novaConta.mes} onChange={(e) => setNovaConta({...novaConta, mes: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <button onClick={adicionarConta} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                  <PlusCircle size={20} /> Adicionar
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Filtrar por Mês:</label>
                <input type="month" value={mesFiltroContas} onChange={(e) => setMesFiltroContas(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-left">Valor</th>
                      <th className="px-4 py-2 text-left">Mês</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contas.filter(c => c.mes === mesFiltroContas).map(c => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{c.tipo}</td>
                        <td className="px-4 py-2">R$ {c.valor.toFixed(2)}</td>
                        <td className="px-4 py-2">{c.mes}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => excluirConta(c.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contas.filter(c => c.mes === mesFiltroContas).length === 0 && (
                  <p className="text-center text-gray-500 mt-4">Nenhuma conta registrada para este mês</p>
                )}
              </div>
            </div>
          )}

          {/* Aba Manutenções */}
          {activeTab === 'manutencoes' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Manutenções Ocasionais</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <input type="text" placeholder="Descrição" value={novaManutencao.descricao} onChange={(e) => setNovaManutencao({...novaManutencao, descricao: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="number" placeholder="Valor (R$)" value={novaManutencao.valor} onChange={(e) => setNovaManutencao({...novaManutencao, valor: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <input type="date" value={novaManutencao.data} onChange={(e) => setNovaManutencao({...novaManutencao, data: e.target.value})} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <button onClick={adicionarManutencao} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                  <PlusCircle size={20} /> Adicionar
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Filtrar por Mês:</label>
                <input type="month" value={mesFiltroManutencoes} onChange={(e) => setMesFiltroManutencoes(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Descrição</th>
                      <th className="px-4 py-2 text-left">Valor</th>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manutencoes.filter(m => m.data.slice(0, 7) === mesFiltroManutencoes).map(m => (
                      <tr key={m.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{m.descricao}</td>
                        <td className="px-4 py-2">R$ {m.valor.toFixed(2)}</td>
                        <td className="px-4 py-2">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => excluirManutencao(m.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {manutencoes.filter(m => m.data.slice(0, 7) === mesFiltroManutencoes).length === 0 && (
                  <p className="text-center text-gray-500 mt-4">Nenhuma manutenção registrada para este mês</p>
                )}
              </div>
            </div>
          )}

          {/* Aba Estoque */}
          {activeTab === 'estoque' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Controle de Estoque</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Quantidade</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoque.map(e => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{e.item}</td>
                        <td className="px-4 py-2">{e.quantidade}</td>
                        <td className="px-4 py-2">
                          <input type="number" placeholder="Qtd" className="border border-gray-300 rounded px-2 py-1 w-20 mr-2" id={`baixa-${e.id}`} />
                          <button onClick={() => {
                            const qtd = parseFloat(document.getElementById(`baixa-${e.id}`).value);
                            if (qtd > 0) {
                              darBaixaEstoque(e.id, qtd);
                              document.getElementById(`baixa-${e.id}`).value = '';
                            }
                          }} className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition">
                            Dar Baixa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba Relatórios */}
          {activeTab === 'relatorios' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Relatórios de Gastos</h2>
              
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">Selecione o Mês:</label>
                <input type="month" value={mesRelatorio} onChange={(e) => setMesRelatorio(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800">Compras</h3>
                  <p className="text-3xl font-bold text-blue-900">R$ {relatorio.totalCompras.toFixed(2)}</p>
                </div>
                <div className="bg-green-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800">Contas</h3>
                  <p className="text-3xl font-bold text-green-900">R$ {relatorio.totalContas.toFixed(2)}</p>
                </div>
                <div className="bg-yellow-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-yellow-800">Manutenções</h3>
                  <p className="text-3xl font-bold text-yellow-900">R$ {relatorio.totalManutencoes.toFixed(2)}</p>
                </div>
                <div className="bg-red-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-800">Total Geral</h3>
                  <p className="text-3xl font-bold text-red-900">R$ {relatorio.totalGeral.toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Gastos por Categoria de Conta</h3>
                <div className="space-y-2">
                  {Object.entries(relatorio.contasPorTipo).map(([tipo, valor]) => (
                    <div key={tipo} className="flex items-center">
                      <span className="w-32 font-semibold">{tipo}:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div className="bg-indigo-600 h-full flex items-center justify-end pr-2 text-white text-sm font-semibold" style={{width: `${(valor / relatorio.totalContas) * 100}%`}}>
                          R$ {valor.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Distribuição Geral de Gastos</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="w-32 font-semibold">Compras:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div className="bg-blue-500 h-full flex items-center justify-end pr-2 text-white font-semibold" style={{width: `${(relatorio.totalCompras / relatorio.totalGeral) * 100}%`}}>
                        {((relatorio.totalCompras / relatorio.totalGeral) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 font-semibold">Contas:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div className="bg-green-500 h-full flex items-center justify-end pr-2 text-white font-semibold" style={{width: `${(relatorio.totalContas / relatorio.totalGeral) * 100}%`}}>
                        {((relatorio.totalContas / relatorio.totalGeral) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 font-semibold">Manutenções:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div className="bg-yellow-500 h-full flex items-center justify-end pr-2 text-white font-semibold" style={{width: `${(relatorio.totalManutencoes / relatorio.totalGeral) * 100}%`}}>
                        {((relatorio.totalManutencoes / relatorio.totalGeral) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceApp;

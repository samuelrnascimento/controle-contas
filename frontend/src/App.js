import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  LogIn,
  LogOut,
  Package,
  PlusCircle,
  Shield,
  ShoppingCart,
  UserPlus,
  Users,
  Wrench,
  XCircle
} from 'lucide-react';

const API_BASE = '/api';
const TOKEN_STORAGE_KEY = 'finansam-auth-token';

const defaultMonth = new Date().toISOString().slice(0, 7);
const defaultDate = new Date().toISOString().slice(0, 10);

const emptyCompra = () => ({ item: '', quantidade: '', valor: '', mes: defaultMonth });
const emptyConta = () => ({ tipo: 'Água', valor: '', mes: defaultMonth });
const emptyManutencao = () => ({ descricao: '', valor: '', data: defaultDate });
const emptyNovoUsuario = () => ({ name: '', email: '', password: '' });

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const tabs = [
  { key: 'compras', label: 'Compras do Mês', icon: ShoppingCart },
  { key: 'contas', label: 'Contas Fixas', icon: DollarSign },
  { key: 'manutencoes', label: 'Manutenções', icon: Wrench },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 }
];

const adminTabs = [{ key: 'admin', label: 'Portal Admin', icon: Shield }];

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const normalizeError = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a operação';
};

const valueToPercent = (value, total) => (Number(value) / Number(total)) * 100;

const SectionHeader = ({ title, description }) => (
  <div>
    <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
    <p className="mt-2 text-slate-600">{description}</p>
  </div>
);

const Field = ({ type = 'text', value, onChange, placeholder }) => (
  <input
    type={type}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
  />
);

const PrimaryButton = ({ icon: Icon, onClick, label, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <Icon size={18} /> {label}
  </button>
);

const DangerTextButton = ({ onClick, label }) => (
  <button type="button" onClick={onClick} className="text-sm font-semibold text-rose-600 transition hover:text-rose-700">
    {label}
  </button>
);

const FilterMonth = ({ value, onChange }) => (
  <div className="mt-6 max-w-xs">
    <label className="mb-2 block text-sm font-semibold text-slate-700">Filtrar por mês</label>
    <Field type="month" value={value} onChange={onChange} />
  </div>
);

const MetricCard = ({ title, value, tone }) => (
  <div className={`rounded-3xl p-5 ${tone}`}>
    <p className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</p>
    <p className="mt-3 text-3xl font-black">{value}</p>
  </div>
);

const SummaryRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
    <span className="text-sm text-slate-300">{label}</span>
    <span className="text-lg font-bold text-white">{value}</span>
  </div>
);

const DataTable = ({ headers, rows, emptyMessage }) => (
  <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
    <table className="min-w-full bg-white text-left text-sm">
      <thead className="bg-slate-100 text-slate-600">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-3 font-semibold">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`row-${index}`} className="border-t border-slate-100 text-slate-700">
            {row.map((cell, cellIndex) => (
              <td key={`cell-${index}-${cellIndex}`} className="px-4 py-3 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">{emptyMessage}</p>}
  </div>
);

const FinanceApp = () => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('compras');
  const [compras, setCompras] = useState([]);
  const [contas, setContas] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(Boolean(token));
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [novaCompra, setNovaCompra] = useState(emptyCompra());
  const [novaConta, setNovaConta] = useState(emptyConta());
  const [novaManutencao, setNovaManutencao] = useState(emptyManutencao());
  const [novoUsuario, setNovoUsuario] = useState(emptyNovoUsuario());
  const [senhaResetUsuario, setSenhaResetUsuario] = useState({});
  const [mesRelatorio, setMesRelatorio] = useState(defaultMonth);
  const [mesFiltroCompras, setMesFiltroCompras] = useState(defaultMonth);
  const [mesFiltroContas, setMesFiltroContas] = useState(defaultMonth);
  const [mesFiltroManutencoes, setMesFiltroManutencoes] = useState(defaultMonth);
  const [baixasEstoque, setBaixasEstoque] = useState({});

  const isAdmin = user?.role === 'admin';

  const apiFetch = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const message = data?.error || data?.message || 'Falha na requisição';

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken('');
        setUser(null);
      }

      throw new Error(message);
    }

    return data;
  };

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const loadProtectedData = async (shouldLoadUsers = isAdmin) => {
    const requests = [
      apiFetch('/compras'),
      apiFetch('/contas'),
      apiFetch('/manutencoes'),
      apiFetch('/estoque')
    ];

    if (shouldLoadUsers) {
      requests.push(apiFetch('/users'));
    }

    const [comprasData, contasData, manutencoesData, estoqueData, usersData] = await Promise.all(requests);

    setCompras(comprasData);
    setContas(contasData);
    setManutencoes(manutencoesData);
    setEstoque(estoqueData);

    if (shouldLoadUsers) {
      setUsuarios(usersData);
    } else {
      setUsuarios([]);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setSessionLoading(false);
        return;
      }

      try {
        const session = await apiFetch('/auth/me');
        setUser(session.user);
        await loadProtectedData(session.user.role === 'admin');
      } catch (error) {
        setErrorMessage(normalizeError(error));
      } finally {
        setSessionLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setUser(null);
    setCompras([]);
    setContas([]);
    setManutencoes([]);
    setEstoque([]);
    setUsuarios([]);
    clearMessages();
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      await loadProtectedData(data.user.role === 'admin');
      setLoginForm({ email: '', password: '' });
      setSuccessMessage(`Sessão iniciada como ${data.user.name}`);
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const runMutation = async (action, successText) => {
    clearMessages();
    setLoading(true);

    try {
      await action();
      await loadProtectedData();
      setSuccessMessage(successText);
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const adicionarCompra = async () => {
    if (!novaCompra.item || !novaCompra.quantidade || !novaCompra.valor || !novaCompra.mes) {
      setErrorMessage('Preencha todos os campos da compra');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/compras', {
        method: 'POST',
        body: JSON.stringify(novaCompra)
      });
      setNovaCompra(emptyCompra());
    }, 'Compra adicionada com sucesso');
  };

  const adicionarConta = async () => {
    if (!novaConta.valor || !novaConta.mes || !novaConta.tipo) {
      setErrorMessage('Preencha todos os campos da conta');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/contas', {
        method: 'POST',
        body: JSON.stringify(novaConta)
      });
      setNovaConta(emptyConta());
    }, 'Conta adicionada com sucesso');
  };

  const adicionarManutencao = async () => {
    if (!novaManutencao.descricao || !novaManutencao.valor || !novaManutencao.data) {
      setErrorMessage('Preencha todos os campos da manutenção');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/manutencoes', {
        method: 'POST',
        body: JSON.stringify(novaManutencao)
      });
      setNovaManutencao(emptyManutencao());
    }, 'Manutenção adicionada com sucesso');
  };

  const darBaixaEstoque = async (id) => {
    const quantidade = Number(baixasEstoque[id]);

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setErrorMessage('Informe uma quantidade válida para baixa');
      return;
    }

    await runMutation(async () => {
      await apiFetch(`/estoque/${id}/baixa`, {
        method: 'PATCH',
        body: JSON.stringify({ quantidade })
      });
      setBaixasEstoque((current) => ({ ...current, [id]: '' }));
    }, 'Baixa de estoque realizada com sucesso');
  };

  const excluirRegistro = async (path, successText) => {
    await runMutation(async () => {
      await apiFetch(path, { method: 'DELETE' });
    }, successText);
  };

  const criarUsuario = async () => {
    if (!novoUsuario.name || !novoUsuario.email || !novoUsuario.password) {
      setErrorMessage('Preencha nome, e-mail e senha do novo usuário');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(novoUsuario)
      });
      setNovoUsuario(emptyNovoUsuario());
    }, 'Usuário criado com sucesso');
  };

  const atualizarUsuario = async (userId, payload, successText) => {
    await runMutation(async () => {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setSenhaResetUsuario((current) => ({ ...current, [userId]: '' }));
    }, successText);
  };

  const relatorio = useMemo(() => {
    const comprasMes = compras.filter((compra) => compra.mes === mesRelatorio);
    const contasMes = contas.filter((conta) => conta.mes === mesRelatorio);
    const manutencoesMes = manutencoes.filter((manutencao) => manutencao.data.slice(0, 7) === mesRelatorio);

    const totalCompras = comprasMes.reduce((acc, compra) => acc + Number(compra.valor), 0);
    const totalContas = contasMes.reduce((acc, conta) => acc + Number(conta.valor), 0);
    const totalManutencoes = manutencoesMes.reduce((acc, manutencao) => acc + Number(manutencao.valor), 0);
    const totalGeral = totalCompras + totalContas + totalManutencoes;

    const contasPorTipo = contasMes.reduce((acc, conta) => {
      acc[conta.tipo] = (acc[conta.tipo] || 0) + Number(conta.valor);
      return acc;
    }, {});

    return {
      comprasMes,
      contasMes,
      manutencoesMes,
      contasPorTipo,
      totalCompras,
      totalContas,
      totalManutencoes,
      totalGeral
    };
  }, [compras, contas, manutencoes, mesRelatorio]);

  const distributionItems = [
    { label: 'Compras', total: relatorio.totalCompras, className: 'bg-blue-500' },
    { label: 'Contas', total: relatorio.totalContas, className: 'bg-emerald-500' },
    { label: 'Manutenções', total: relatorio.totalManutencoes, className: 'bg-amber-500' }
  ];

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 shadow-2xl backdrop-blur">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_32%),linear-gradient(135deg,#07111f_0%,#10203b_55%,#1e293b_100%)] text-slate-100 px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-emerald-400/20 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100">
              <Shield size={16} /> Plataforma protegida
            </span>
            <h1 className="mt-6 max-w-xl text-5xl font-black tracking-tight text-white">
              Finansam com portal do proprietário, usuários e dados centralizados.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              A aplicação deixou o modo local em navegador e passou a exigir autenticação real, com um único administrador dono da ferramenta e usuários operacionais separados.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Antes</p>
                <p className="mt-2 text-sm text-slate-200">Sem login, sem perfis, dados em localStorage.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Agora</p>
                <p className="mt-2 text-sm text-slate-200">JWT, PostgreSQL, permissões por papel e painel admin.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Admin</p>
                <p className="mt-2 text-sm text-slate-200">Pode criar usuários, resetar senha e desativar contas.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] bg-[#f8f5ef] p-8 text-slate-900 shadow-[0_24px_90px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-950 p-3 text-emerald-300">
                <LogIn size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Entrar</h2>
                <p className="text-sm text-slate-600">Use o administrador inicial definido no backend.</p>
              </div>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">E-mail</span>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200"
                  placeholder="owner@finansam.local"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Senha</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200"
                  placeholder="Sua senha"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={18} /> {loading ? 'Entrando...' : 'Iniciar sessão'}
              </button>
            </form>

            {errorMessage && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                <AlertCircle size={18} className="mt-0.5" /> {errorMessage}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 p-4 text-sm text-slate-600">
              Credenciais iniciais: defina ADMIN_EMAIL e ADMIN_PASSWORD no serviço backend do compose antes de produção.
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4efe6_0%,#fbfaf7_46%,#f3f6fb_100%)] px-4 py-6 text-slate-900 md:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_24px_90px_rgba(15,23,42,0.35)]">
          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Finansam</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Operação diária e governança do proprietário em um único painel.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Sessão autenticada para {user.name}. Usuários comuns podem operar registros e estoque. O proprietário controla acessos, estado das contas e credenciais operacionais.
              </p>
            </div>
            <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Usuário ativo</p>
                <p className="mt-2 text-2xl font-bold">{user.name}</p>
                <p className="text-sm text-slate-300">{user.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isAdmin ? 'bg-emerald-400/15 text-emerald-200' : 'bg-sky-400/15 text-sky-200'}`}>
                  {isAdmin ? 'Proprietário / Admin' : 'Usuário operacional'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            </div>
          </div>
        </header>

        {(errorMessage || successMessage) && (
          <div className="mb-6 grid gap-3">
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
                <XCircle size={18} className="mt-0.5" /> {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 shadow-sm">
                <CheckCircle2 size={18} className="mt-0.5" /> {successMessage}
              </div>
            )}
          </div>
        )}

        <nav className="mb-6 flex flex-wrap gap-3 rounded-[28px] bg-white p-3 shadow-lg shadow-slate-200/70">
          {[...tabs, ...(isAdmin ? adminTabs : [])].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                <Icon size={18} /> {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
          <div className="rounded-[30px] bg-white p-6 shadow-xl shadow-slate-200/60">
            {activeTab === 'compras' && (
              <div>
                <SectionHeader title="Compras do Mês" description="Toda compra alimenta automaticamente o estoque central." />
                <div className="mt-6 grid gap-4 md:grid-cols-5">
                  <Field value={novaCompra.item} onChange={(value) => setNovaCompra((current) => ({ ...current, item: value }))} placeholder="Item" />
                  <Field type="number" value={novaCompra.quantidade} onChange={(value) => setNovaCompra((current) => ({ ...current, quantidade: value }))} placeholder="Quantidade" />
                  <Field type="number" value={novaCompra.valor} onChange={(value) => setNovaCompra((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                  <Field type="month" value={novaCompra.mes} onChange={(value) => setNovaCompra((current) => ({ ...current, mes: value }))} />
                  <PrimaryButton icon={PlusCircle} onClick={adicionarCompra} disabled={loading} label="Adicionar" />
                </div>
                <FilterMonth value={mesFiltroCompras} onChange={setMesFiltroCompras} />
                <DataTable
                  headers={['Item', 'Quantidade', 'Valor', 'Mês', 'Ações']}
                  rows={compras.filter((compra) => compra.mes === mesFiltroCompras).map((compra) => [
                    compra.item,
                    compra.quantidade,
                    formatCurrency(compra.valor),
                    compra.mes,
                    isAdmin ? (
                      <DangerTextButton key={`delete-compra-${compra.id}`} onClick={() => excluirRegistro(`/compras/${compra.id}`, 'Compra excluída com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-compra-${compra.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhuma compra registrada para este mês"
                />
              </div>
            )}

            {activeTab === 'contas' && (
              <div>
                <SectionHeader title="Contas Fixas" description="Registro mensal consolidado por categoria." />
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <select
                    value={novaConta.tipo}
                    onChange={(event) => setNovaConta((current) => ({ ...current, tipo: event.target.value }))}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option>Água</option>
                    <option>Luz</option>
                    <option>Telefone</option>
                    <option>Gás</option>
                    <option>Internet</option>
                    <option>Condomínio</option>
                    <option>Outros</option>
                  </select>
                  <Field type="number" value={novaConta.valor} onChange={(value) => setNovaConta((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                  <Field type="month" value={novaConta.mes} onChange={(value) => setNovaConta((current) => ({ ...current, mes: value }))} />
                  <PrimaryButton icon={PlusCircle} onClick={adicionarConta} disabled={loading} label="Adicionar" />
                </div>
                <FilterMonth value={mesFiltroContas} onChange={setMesFiltroContas} />
                <DataTable
                  headers={['Tipo', 'Valor', 'Mês', 'Ações']}
                  rows={contas.filter((conta) => conta.mes === mesFiltroContas).map((conta) => [
                    conta.tipo,
                    formatCurrency(conta.valor),
                    conta.mes,
                    isAdmin ? (
                      <DangerTextButton key={`delete-conta-${conta.id}`} onClick={() => excluirRegistro(`/contas/${conta.id}`, 'Conta excluída com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-conta-${conta.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhuma conta registrada para este mês"
                />
              </div>
            )}

            {activeTab === 'manutencoes' && (
              <div>
                <SectionHeader title="Manutenções" description="Custos ocasionais separados das contas fixas." />
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <Field value={novaManutencao.descricao} onChange={(value) => setNovaManutencao((current) => ({ ...current, descricao: value }))} placeholder="Descrição" />
                  <Field type="number" value={novaManutencao.valor} onChange={(value) => setNovaManutencao((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                  <Field type="date" value={novaManutencao.data} onChange={(value) => setNovaManutencao((current) => ({ ...current, data: value }))} />
                  <PrimaryButton icon={PlusCircle} onClick={adicionarManutencao} disabled={loading} label="Adicionar" />
                </div>
                <FilterMonth value={mesFiltroManutencoes} onChange={setMesFiltroManutencoes} />
                <DataTable
                  headers={['Descrição', 'Valor', 'Data', 'Ações']}
                  rows={manutencoes.filter((manutencao) => manutencao.data.slice(0, 7) === mesFiltroManutencoes).map((manutencao) => [
                    manutencao.descricao,
                    formatCurrency(manutencao.valor),
                    new Date(manutencao.data).toLocaleDateString('pt-BR'),
                    isAdmin ? (
                      <DangerTextButton key={`delete-manutencao-${manutencao.id}`} onClick={() => excluirRegistro(`/manutencoes/${manutencao.id}`, 'Manutenção excluída com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-manutencao-${manutencao.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhuma manutenção registrada para este mês"
                />
              </div>
            )}

            {activeTab === 'estoque' && (
              <div>
                <SectionHeader title="Controle de Estoque" description="Qualquer usuário ativo pode registrar baixa, respeitando saldo disponível." />
                <DataTable
                  headers={['Item', 'Quantidade', 'Baixa']}
                  rows={estoque.map((item) => [
                    item.item,
                    item.quantidade,
                    <div key={`estoque-${item.id}`} className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        value={baixasEstoque[item.id] || ''}
                        onChange={(event) => setBaixasEstoque((current) => ({ ...current, [item.id]: event.target.value }))}
                        className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                        placeholder="Qtd"
                      />
                      <button
                        type="button"
                        onClick={() => darBaixaEstoque(item.id)}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                      >
                        Dar baixa
                      </button>
                    </div>
                  ])}
                  emptyMessage="Nenhum item em estoque"
                />
              </div>
            )}

            {activeTab === 'relatorios' && (
              <div>
                <SectionHeader title="Relatórios" description="Visão mensal consolidada a partir dos dados do backend." />
                <div className="mt-6 max-w-xs">
                  <Field type="month" value={mesRelatorio} onChange={setMesRelatorio} />
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="Compras" value={formatCurrency(relatorio.totalCompras)} tone="bg-blue-100 text-blue-900" />
                  <MetricCard title="Contas" value={formatCurrency(relatorio.totalContas)} tone="bg-emerald-100 text-emerald-900" />
                  <MetricCard title="Manutenções" value={formatCurrency(relatorio.totalManutencoes)} tone="bg-amber-100 text-amber-900" />
                  <MetricCard title="Total Geral" value={formatCurrency(relatorio.totalGeral)} tone="bg-rose-100 text-rose-900" />
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-bold">Gastos por tipo de conta</h3>
                    <div className="mt-4 space-y-3">
                      {Object.keys(relatorio.contasPorTipo).length === 0 && <p className="text-sm text-slate-500">Sem contas no mês selecionado.</p>}
                      {Object.entries(relatorio.contasPorTipo).map(([tipo, valor]) => {
                        const width = relatorio.totalContas > 0 ? valueToPercent(valor, relatorio.totalContas) : 0;

                        return (
                          <div key={tipo}>
                            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                              <span>{tipo}</span>
                              <span>{formatCurrency(valor)}</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-lg font-bold">Distribuição geral</h3>
                    <div className="mt-4 space-y-4">
                      {distributionItems.map((item) => {
                        const width = relatorio.totalGeral > 0 ? valueToPercent(item.total, relatorio.totalGeral) : 0;

                        return (
                          <div key={item.label}>
                            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                              <span>{item.label}</span>
                              <span>{width.toFixed(1)}%</span>
                            </div>
                            <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-full rounded-full ${item.className}`} style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && isAdmin && (
              <div>
                <SectionHeader title="Portal Administrativo" description="Gestão do proprietário: acessos, senhas e diagnóstico da migração para backend centralizado." />

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <UserPlus size={20} />
                      <h3 className="text-lg font-bold">Criar usuário operacional</h3>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <Field value={novoUsuario.name} onChange={(value) => setNovoUsuario((current) => ({ ...current, name: value }))} placeholder="Nome" />
                      <Field type="email" value={novoUsuario.email} onChange={(value) => setNovoUsuario((current) => ({ ...current, email: value }))} placeholder="E-mail" />
                      <Field type="password" value={novoUsuario.password} onChange={(value) => setNovoUsuario((current) => ({ ...current, password: value }))} placeholder="Senha temporária" />
                      <PrimaryButton icon={Users} onClick={criarUsuario} disabled={loading} label="Criar usuário" />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} />
                      <h3 className="text-lg font-bold">Diagnóstico e migração</h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      <li>Antes, o frontend persistia tudo em localStorage. Isso impedia governança central, auditoria e acesso por múltiplos usuários.</li>
                      <li>Agora, login e autorização passam pelo backend, com token JWT e dados persistidos no PostgreSQL.</li>
                      <li>Existe exatamente um administrador proprietário. Usuários adicionais são sempre operacionais.</li>
                      <li>Exclusões de compras, contas e manutenções ficam restritas ao proprietário para reduzir risco operacional.</li>
                      <li>Os registros antigos em localStorage não são migrados automaticamente. Se houver dados no navegador antigo, eles precisam ser importados manualmente.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-lg font-bold">Usuários cadastrados</h3>
                  </div>
                  <div className="overflow-x-auto px-5 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">Nome</th>
                          <th className="pb-3 pr-4 font-semibold">E-mail</th>
                          <th className="pb-3 pr-4 font-semibold">Papel</th>
                          <th className="pb-3 pr-4 font-semibold">Status</th>
                          <th className="pb-3 pr-4 font-semibold">Senha</th>
                          <th className="pb-3 pr-4 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((registeredUser) => (
                          <tr key={registeredUser.id} className="border-t border-slate-100 align-top">
                            <td className="py-4 pr-4 font-semibold text-slate-800">{registeredUser.name}</td>
                            <td className="py-4 pr-4 text-slate-600">{registeredUser.email}</td>
                            <td className="py-4 pr-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${registeredUser.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                                {registeredUser.role === 'admin' ? 'Admin' : 'Usuário'}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${registeredUser.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                {registeredUser.active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <input
                                type="password"
                                value={senhaResetUsuario[registeredUser.id] || ''}
                                onChange={(event) => setSenhaResetUsuario((current) => ({ ...current, [registeredUser.id]: event.target.value }))}
                                className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                                placeholder="Nova senha"
                              />
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => atualizarUsuario(registeredUser.id, { active: !registeredUser.active }, registeredUser.active ? 'Usuário desativado' : 'Usuário reativado')}
                                  disabled={registeredUser.role === 'admin' || loading}
                                  className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {registeredUser.active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => atualizarUsuario(registeredUser.id, { password: senhaResetUsuario[registeredUser.id] }, 'Senha atualizada')}
                                  disabled={!senhaResetUsuario[registeredUser.id] || loading}
                                  className="rounded-xl bg-slate-950 px-3 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Resetar senha
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/40">
              <p className="text-sm uppercase tracking-[0.22em] text-emerald-300">Resumo</p>
              <div className="mt-4 space-y-4">
                <SummaryRow label="Compras cadastradas" value={String(compras.length)} />
                <SummaryRow label="Contas cadastradas" value={String(contas.length)} />
                <SummaryRow label="Manutenções" value={String(manutencoes.length)} />
                <SummaryRow label="Itens em estoque" value={String(estoque.length)} />
                {isAdmin && <SummaryRow label="Usuários ativos" value={String(usuarios.filter((registeredUser) => registeredUser.active).length)} />}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Permissões</p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
                <p>Usuário operacional: cria compras, contas, manutenções e realiza baixa de estoque.</p>
                <p>Proprietário: além do fluxo operacional, gerencia usuários e exclusões críticas.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default FinanceApp;

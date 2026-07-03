import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  DollarSign,
  Gamepad2,
  Landmark,
  LogIn,
  LogOut,
  Package,
  Pencil,
  PlusCircle,
  Shield,
  ShoppingCart,
  Tag,
  UserPlus,
  Users,
  Trash2,
  Wrench,
  XCircle
} from 'lucide-react';

const API_BASE = '/api';
const TOKEN_STORAGE_KEY = 'finansam-auth-token';
const TENANT_VIEW_STORAGE_KEY = 'finansam-platform-tenant-view';
const MONTHLY_VIEW_STORAGE_KEY = 'finansam-monthly-view';
const TENANT_PLANS = ['Starter', 'Smart', 'Premium'];
const TENANT_STATUSES = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' }
];

const defaultMonth = new Date().toISOString().slice(0, 7);
const defaultDate = new Date().toISOString().slice(0, 10);

const emptyCompra = () => ({ item: '', quantidade: '', valor: '', mes: defaultMonth });
const emptyConta = () => ({ tipo: '', valor: '', mes: defaultMonth });
const emptyLazer = () => ({ descricao: '', valor: '', mes: defaultMonth });
const emptyManutencao = () => ({ descricao: '', valor: '', data: defaultDate });
const emptyInvestimento = () => ({ descricao: '', valor: '', mes: defaultMonth, nota: '' });
const emptyNovoUsuario = () => ({ name: '', email: '', password: '' });
const emptyCreateTenantForm = () => ({
  firstName: '',
  lastName: '',
  company: '',
  plan: 'Starter',
  status: 'active',
  phone: '',
  email: '',
  createAdminUser: true,
  adminEmail: '',
  adminPassword: ''
});
const emptyEditTenantForm = () => ({
  firstName: '',
  lastName: '',
  company: '',
  plan: 'Starter',
  status: 'active',
  phone: '',
  email: '',
  createAdminUser: false,
  adminEmail: '',
  adminPassword: ''
});
const defaultTenantSort = () => ({ key: 'name', direction: 'asc' });
const isMonthValueValid = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));
const normalizeTenantSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeTenantPlan = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'starter') {
    return 'Starter';
  }

  if (normalized === 'smart') {
    return 'Smart';
  }

  if (normalized === 'premium') {
    return 'Premium';
  }

  return null;
};

const normalizeTenantStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'active' || normalized === 'ativo') {
    return 'active';
  }

  if (normalized === 'inactive' || normalized === 'inativo') {
    return 'inactive';
  }

  return null;
};

const readTenantViewPreferences = () => {
  try {
    const raw = localStorage.getItem(TENANT_VIEW_STORAGE_KEY);

    if (!raw) {
      return {
        planFilter: 'all',
        statusFilter: 'all',
        searchTerm: '',
        sortConfig: defaultTenantSort()
      };
    }

    const parsed = JSON.parse(raw);
    const allowedKeys = ['name', 'plan', 'subscription_status'];
    const nextKey = allowedKeys.includes(parsed?.sortConfig?.key) ? parsed.sortConfig.key : 'name';
    const nextDirection = parsed?.sortConfig?.direction === 'desc' ? 'desc' : 'asc';
    const nextPlanFilter = typeof parsed?.planFilter === 'string' ? parsed.planFilter : 'all';
    const isPlanFilterValid = nextPlanFilter === 'all' || TENANT_PLANS.includes(nextPlanFilter);

    return {
      planFilter: isPlanFilterValid ? nextPlanFilter : 'all',
      statusFilter: typeof parsed?.statusFilter === 'string' ? parsed.statusFilter : 'all',
      searchTerm: typeof parsed?.searchTerm === 'string' ? parsed.searchTerm : '',
      sortConfig: { key: nextKey, direction: nextDirection }
    };
  } catch (_error) {
    return {
      planFilter: 'all',
      statusFilter: 'all',
      searchTerm: '',
      sortConfig: defaultTenantSort()
    };
  }
};

const readMonthlyViewPreferences = () => {
  try {
    const raw = localStorage.getItem(MONTHLY_VIEW_STORAGE_KEY);

    if (!raw) {
      return {
        reportMonth: defaultMonth,
        comprasMonth: defaultMonth,
        contasMonth: defaultMonth,
        lazerMonth: defaultMonth,
        manutencoesMonth: defaultMonth,
        investimentosMonth: defaultMonth
      };
    }

    const parsed = JSON.parse(raw);

    return {
      reportMonth: isMonthValueValid(parsed?.reportMonth) ? parsed.reportMonth : defaultMonth,
      comprasMonth: isMonthValueValid(parsed?.comprasMonth) ? parsed.comprasMonth : defaultMonth,
      contasMonth: isMonthValueValid(parsed?.contasMonth) ? parsed.contasMonth : defaultMonth,
      lazerMonth: isMonthValueValid(parsed?.lazerMonth) ? parsed.lazerMonth : defaultMonth,
      manutencoesMonth: isMonthValueValid(parsed?.manutencoesMonth) ? parsed.manutencoesMonth : defaultMonth,
      investimentosMonth: isMonthValueValid(parsed?.investimentosMonth) ? parsed.investimentosMonth : defaultMonth
    };
  } catch (_error) {
    return {
      reportMonth: defaultMonth,
      comprasMonth: defaultMonth,
      contasMonth: defaultMonth,
      lazerMonth: defaultMonth,
      manutencoesMonth: defaultMonth,
      investimentosMonth: defaultMonth
    };
  }
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const tabs = [
  { key: 'compras', label: 'Compras do Mês', icon: ShoppingCart },
  { key: 'contas', label: 'Contas Fixas', icon: DollarSign },
  { key: 'lazer', label: 'Lazer', icon: Gamepad2 },
  { key: 'investimentos', label: 'Investimentos', icon: Landmark },
  { key: 'manutencoes', label: 'Extraordinárias', icon: Wrench },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 }
];

const adminTabs = [
  { key: 'admin', label: 'Portal Admin', icon: Shield },
  { key: 'categories', label: 'Categorias', icon: Tag }
];
const platformTabs = [{ key: 'platform', label: 'Plataforma', icon: Building2 }];

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const normalizeError = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a operação';
};

const valueToPercent = (value, total) => (Number(value) / Number(total)) * 100;

const SectionHeader = ({ title, description }) => (
  <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
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

const getPreviousMonth = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
};

const getNextMonth = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[month - 1]} ${year}`;
};

const FilterMonth = ({ value, onChange }) => (
  <div className="mt-6 flex items-center justify-between gap-4">
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">Filtrar por mês</label>
      <div className="flex gap-2">
        <button 
          type="button"
          onClick={() => onChange(getPreviousMonth(value))}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          ← Anterior
        </button>
        <Field type="month" value={value} onChange={onChange} />
        <button 
          type="button"
          onClick={() => onChange(getNextMonth(value))}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          Próximo →
        </button>
      </div>
    </div>
    <span className="text-lg font-bold text-slate-800">{getMonthLabel(value)}</span>
  </div>
);

const MetricCard = ({ title, value, tone }) => (
  <div className={`rounded-[28px] border border-white/50 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)] ${tone}`}>
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
  <div className="mt-6 overflow-x-auto rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
    <table className="min-w-full bg-transparent text-left text-sm">
      <thead className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_100%)] text-slate-600">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-4 font-semibold uppercase tracking-[0.08em] text-slate-500">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`row-${index}`} className="border-t border-slate-100/90 text-slate-700 transition hover:bg-slate-50/80">
            {row.map((cell, cellIndex) => (
              <td key={`cell-${index}-${cellIndex}`} className="px-4 py-4 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>}
  </div>
);

const FinanceApp = () => {
  const tenantViewPreferences = readTenantViewPreferences();
  const monthlyViewPreferences = readMonthlyViewPreferences();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('compras');
  const [compras, setCompras] = useState([]);
  const [contas, setContas] = useState([]);
  const [lazer, setLazer] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [investimentos, setInvestimentos] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [platformTenants, setPlatformTenants] = useState([]);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [platformAdmins, setPlatformAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(Boolean(token));
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [novaCompra, setNovaCompra] = useState(emptyCompra());
  const [novaConta, setNovaConta] = useState(emptyConta());
  const [novoLazer, setNovoLazer] = useState(emptyLazer());
  const [novoInvestimento, setNovoInvestimento] = useState(emptyInvestimento());
  const [novaManutencao, setNovaManutencao] = useState(emptyManutencao());
  const [novoUsuario, setNovoUsuario] = useState(emptyNovoUsuario());
  const [novaCategoriaConta, setNovaCategoriaConta] = useState('');
  const [novaCategoriaInvestimento, setNovaCategoriaInvestimento] = useState('');
  const [showCreateTenantForm, setShowCreateTenantForm] = useState(false);
  const [createTenantForm, setCreateTenantForm] = useState(emptyCreateTenantForm());
  const [editTenantForm, setEditTenantForm] = useState(emptyEditTenantForm());
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [tenantPlanFilter, setTenantPlanFilter] = useState(tenantViewPreferences.planFilter);
  const [tenantStatusFilter, setTenantStatusFilter] = useState(tenantViewPreferences.statusFilter);
  const [tenantSearchTerm, setTenantSearchTerm] = useState(tenantViewPreferences.searchTerm);
  const [tenantSortConfig, setTenantSortConfig] = useState(tenantViewPreferences.sortConfig);
  const [senhaResetUsuario, setSenhaResetUsuario] = useState({});
  const [mesRelatorio, setMesRelatorio] = useState(monthlyViewPreferences.reportMonth);
  const [mesFiltroCompras, setMesFiltroCompras] = useState(monthlyViewPreferences.comprasMonth);
  const [mesFiltroContas, setMesFiltroContas] = useState(monthlyViewPreferences.contasMonth);
  const [mesFiltroLazer, setMesFiltroLazer] = useState(monthlyViewPreferences.lazerMonth);
  const [mesFiltroManutencoes, setMesFiltroManutencoes] = useState(monthlyViewPreferences.manutencoesMonth);
  const [mesFiltroInvestimentos, setMesFiltroInvestimentos] = useState(monthlyViewPreferences.investimentosMonth);
  const [baixasEstoque, setBaixasEstoque] = useState({});

  const isPlatformAdmin = user?.scope === 'platform' || user?.role === 'super_admin';
  const isAdmin = !isPlatformAdmin && (user?.role === 'admin' || user?.role === 'owner');

  const apiFetch = async (path, options = {}) => {
    const authToken = options.authToken ?? token;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
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

  const loadProtectedData = async (sessionUser = user, authToken) => {
    const isPlatformScope = sessionUser?.scope === 'platform' || sessionUser?.role === 'super_admin';

    if (isPlatformScope) {
      const [tenantsData, usersData, adminsData] = await Promise.all([
        apiFetch('/platform/tenants', { authToken }),
        apiFetch('/platform/users', { authToken }),
        apiFetch('/platform/admins', { authToken })
      ]);

      setPlatformTenants(tenantsData);
      setPlatformUsers(usersData);
      setPlatformAdmins(adminsData);
      setCompras([]);
      setContas([]);
      setLazer([]);
      setCategorias([]);
      setInvestimentos([]);
      setManutencoes([]);
      setEstoque([]);
      setUsuarios([]);
      return;
    }

    const shouldLoadUsers = sessionUser?.role === 'admin' || sessionUser?.role === 'owner';
    const requests = [
      apiFetch('/compras', { authToken }),
      apiFetch('/contas', { authToken }),
      apiFetch('/lazer', { authToken }),
      apiFetch('/categories', { authToken }),
      apiFetch('/investimentos', { authToken }),
      apiFetch('/manutencoes', { authToken }),
      apiFetch('/estoque', { authToken })
    ];

    if (shouldLoadUsers) {
      requests.push(apiFetch('/users', { authToken }));
    }

    const [comprasData, contasData, lazerData, categoriasData, investimentosData, manutencoesData, estoqueData, usersData] = await Promise.all(requests);

    setCompras(comprasData);
    setContas(contasData);
    setLazer(lazerData);
    setCategorias(categoriasData);
    setInvestimentos(investimentosData);
    setManutencoes(manutencoesData);
    setEstoque(estoqueData);

    if (shouldLoadUsers) {
      setUsuarios(usersData);
    } else {
      setUsuarios([]);
    }

    setPlatformTenants([]);
    setPlatformUsers([]);
    setPlatformAdmins([]);
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
        setActiveTab(session.user.scope === 'platform' ? 'platform' : 'compras');
        await loadProtectedData(session.user, token);
      } catch (error) {
        setErrorMessage(normalizeError(error));
      } finally {
        setSessionLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      TENANT_VIEW_STORAGE_KEY,
      JSON.stringify({
        planFilter: tenantPlanFilter,
        statusFilter: tenantStatusFilter,
        searchTerm: tenantSearchTerm,
        sortConfig: tenantSortConfig
      })
    );
  }, [tenantPlanFilter, tenantStatusFilter, tenantSearchTerm, tenantSortConfig]);

  useEffect(() => {
    localStorage.setItem(
      MONTHLY_VIEW_STORAGE_KEY,
      JSON.stringify({
        reportMonth: mesRelatorio,
        comprasMonth: mesFiltroCompras,
        contasMonth: mesFiltroContas,
        lazerMonth: mesFiltroLazer,
        manutencoesMonth: mesFiltroManutencoes,
        investimentosMonth: mesFiltroInvestimentos
      })
    );
  }, [mesRelatorio, mesFiltroCompras, mesFiltroContas, mesFiltroLazer, mesFiltroManutencoes, mesFiltroInvestimentos]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setUser(null);
    setCompras([]);
    setContas([]);
    setLazer([]);
    setCategorias([]);
    setInvestimentos([]);
    setManutencoes([]);
    setEstoque([]);
    setUsuarios([]);
    setPlatformTenants([]);
    setPlatformUsers([]);
    setPlatformAdmins([]);
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
      setActiveTab(data.user.scope === 'platform' ? 'platform' : 'compras');
      await loadProtectedData(data.user, data.token);
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

  const adicionarLazer = async () => {
    if (!novoLazer.descricao || !novoLazer.valor || !novoLazer.mes) {
      setErrorMessage('Preencha todos os campos de lazer');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/lazer', {
        method: 'POST',
        body: JSON.stringify(novoLazer)
      });
      setNovoLazer(emptyLazer());
    }, 'Despesa de lazer adicionada com sucesso');
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
    }, 'Despesa extraordinária adicionada com sucesso');
  };

  const adicionarInvestimento = async () => {
    if (!novoInvestimento.descricao || !novoInvestimento.valor || !novoInvestimento.mes) {
      setErrorMessage('Preencha todos os campos do investimento');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/investimentos', {
        method: 'POST',
        body: JSON.stringify(novoInvestimento)
      });
      setNovoInvestimento(emptyInvestimento());
    }, 'Investimento adicionado com sucesso');
  };

  const adicionarCategoria = async (scope, rawName) => {
    const name = rawName.trim();

    if (!name) {
      setErrorMessage('Informe o nome da categoria');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ scope, name })
      });

      if (scope === 'contas') {
        setNovaCategoriaConta('');
      }

      if (scope === 'investimentos') {
        setNovaCategoriaInvestimento('');
      }
    }, 'Categoria adicionada com sucesso');
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

  const excluirCategoria = async (categoryId) => {
    await runMutation(async () => {
      await apiFetch(`/categories/${categoryId}`, { method: 'DELETE' });
    }, 'Categoria excluída com sucesso');
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

  const excluirUsuarioPlataforma = async (userId) => {
    await runMutation(async () => {
      await apiFetch(`/platform/users/${userId}`, { method: 'DELETE' });
    }, 'Usuário removido da plataforma com sucesso');
  };

  const excluirTenantPlataforma = async (tenantId, tenantSlug) => {
    const confirmation = window.prompt(`Para excluir este tenant, digite o slug exatamente: ${tenantSlug}`);

    if (!confirmation) {
      return;
    }

    await runMutation(async () => {
      await apiFetch(`/platform/tenants/${tenantId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug: confirmation })
      });
    }, 'Tenant removido com sucesso');
  };

  const iniciarEdicaoTenant = (tenant) => {
    setEditingTenantId(String(tenant.id));
    setEditTenantForm({
      firstName: tenant.name || '',
      lastName: '',
      company: tenant.name || '',
      plan: normalizeTenantPlan(tenant.plan) || 'Starter',
      status: normalizeTenantStatus(tenant.subscription_status) || 'active',
      phone: '',
      email: '',
      createAdminUser: false,
      adminEmail: '',
      adminPassword: ''
    });
    clearMessages();
  };

  const cancelarEdicaoTenant = () => {
    setEditingTenantId(null);
    setEditTenantForm(emptyEditTenantForm());
    clearMessages();
  };

  const salvarTenant = async () => {
    if (!editingTenantId) {
      return;
    }

    const firstName = editTenantForm.firstName.trim();
    const lastName = editTenantForm.lastName.trim();
    const company = editTenantForm.company.trim();
    const plan = normalizeTenantPlan(editTenantForm.plan);
    const status = normalizeTenantStatus(editTenantForm.status);
    const phone = editTenantForm.phone.trim();
    const email = editTenantForm.email.trim();
    const createAdminUser = editTenantForm.createAdminUser === true;
    const adminEmail = editTenantForm.adminEmail.trim().toLowerCase();
    const adminPassword = editTenantForm.adminPassword.trim();

    if (!firstName || !plan || !status || !phone || !email) {
      setErrorMessage('Preencha os campos obrigatórios: Nome, Plano, Status, Telefone e Email');
      return;
    }

    if (createAdminUser && !adminEmail) {
      setErrorMessage('Preencha o e-mail do usuário admin');
      return;
    }

    if (createAdminUser && !adminPassword) {
      setErrorMessage('Preencha a senha do usuário admin');
      return;
    }

    const ownerName = `${firstName} ${lastName}`.trim();
    const tenantName = company || ownerName;
    const tenantSlug = normalizeTenantSlug(company || ownerName || email.split('@')[0]);

    if (!tenantName || !tenantSlug) {
      setErrorMessage('Não foi possível gerar os dados do tenant. Revise os campos informados.');
      return;
    }

    const payload = {
      name: tenantName,
      slug: tenantSlug,
      plan,
      subscriptionStatus: status,
      ownerName,
      contactPhone: phone,
      contactEmail: email,
      createAdminUser,
      adminName: ownerName || firstName,
      adminEmail: createAdminUser ? adminEmail : undefined,
      adminPassword: createAdminUser ? adminPassword : undefined
    };

    await runMutation(async () => {
      await apiFetch(`/platform/tenants/${editingTenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditingTenantId(null);
      setEditTenantForm(emptyEditTenantForm());
    }, 'Tenant atualizado com sucesso');
  };

  const criarTenantComFormulario = async () => {
    const firstName = createTenantForm.firstName.trim();
    const lastName = createTenantForm.lastName.trim();
    const company = createTenantForm.company.trim();
    const plan = normalizeTenantPlan(createTenantForm.plan);
    const status = normalizeTenantStatus(createTenantForm.status);
    const phone = createTenantForm.phone.trim();
    const email = createTenantForm.email.trim();
    const createAdminUser = createTenantForm.createAdminUser === true;
    const adminEmail = createTenantForm.adminEmail.trim().toLowerCase();
    const adminPassword = createTenantForm.adminPassword.trim();

    if (!firstName || !plan || !status || !phone || !email) {
      setErrorMessage('Preencha os campos obrigatórios: Nome, Plano, Status, Telefone e Email');
      return;
    }

    if (createAdminUser && !adminEmail) {
      setErrorMessage('Preencha o e-mail do usuário admin');
      return;
    }

    if (createAdminUser && !adminPassword) {
      setErrorMessage('Preencha a senha do usuário admin');
      return;
    }

    const ownerName = `${firstName} ${lastName}`.trim();
    const tenantName = company || ownerName;
    const tenantSlug = normalizeTenantSlug(company || ownerName || email.split('@')[0]);

    if (!tenantName || !tenantSlug) {
      setErrorMessage('Não foi possível gerar os dados do tenant. Revise os campos informados.');
      return;
    }

    await runMutation(async () => {
      await apiFetch('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: tenantName,
          slug: tenantSlug,
          plan,
          subscriptionStatus: status,
          ownerName,
          contactPhone: phone,
          contactEmail: email,
          createAdminUser,
          adminName: ownerName || firstName,
          adminEmail: createAdminUser ? adminEmail : undefined,
          adminPassword: createAdminUser ? adminPassword : undefined
        })
      });

      setCreateTenantForm(emptyCreateTenantForm());
      setShowCreateTenantForm(false);
    }, 'Tenant criado com sucesso');
  };

  const excluirAdminPlataforma = async (adminId, adminEmail) => {
    const confirmation = window.prompt(`Para excluir este super admin, digite o e-mail exatamente: ${adminEmail}`);

    if (!confirmation) {
      return;
    }

    await runMutation(async () => {
      await apiFetch(`/platform/admins/${adminId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmEmail: confirmation })
      });
    }, 'Administrador de plataforma removido com sucesso');
  };

  const relatorio = useMemo(() => {
    const comprasMes = compras.filter((compra) => compra.mes === mesRelatorio);
    const contasMes = contas.filter((conta) => conta.mes === mesRelatorio);
    const lazerMes = lazer.filter((item) => item.mes === mesRelatorio);
    const investimentosMes = investimentos.filter((investimento) => investimento.mes === mesRelatorio);
    const manutencoesMes = manutencoes.filter((manutencao) => manutencao.data.slice(0, 7) === mesRelatorio);

    const totalCompras = comprasMes.reduce((acc, compra) => acc + Number(compra.valor), 0);
    const totalContas = contasMes.reduce((acc, conta) => acc + Number(conta.valor), 0);
    const totalLazer = lazerMes.reduce((acc, item) => acc + Number(item.valor), 0);
    const totalInvestimentos = investimentosMes.reduce((acc, investimento) => acc + Number(investimento.valor), 0);
    const totalManutencoes = manutencoesMes.reduce((acc, manutencao) => acc + Number(manutencao.valor), 0);
    const totalGeral = totalCompras + totalContas + totalLazer + totalInvestimentos + totalManutencoes;

    const contasPorTipo = contasMes.reduce((acc, conta) => {
      acc[conta.tipo] = (acc[conta.tipo] || 0) + Number(conta.valor);
      return acc;
    }, {});

    return {
      comprasMes,
      contasMes,
      lazerMes,
      investimentosMes,
      manutencoesMes,
      contasPorTipo,
      totalCompras,
      totalContas,
      totalLazer,
      totalInvestimentos,
      totalManutencoes,
      totalGeral
    };
  }, [compras, contas, lazer, investimentos, manutencoes, mesRelatorio]);

  const tenantPlanOptions = useMemo(() => {
    const options = Array.from(new Set(
      platformTenants
        .map((tenant) => String(tenant.plan || '').trim())
        .filter(Boolean)
    ));

    return options.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [platformTenants]);

  const tenantStatusOptions = useMemo(() => {
    const options = Array.from(new Set(
      platformTenants
        .map((tenant) => String(tenant.subscription_status || '').trim())
        .filter(Boolean)
    ));

    return options.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [platformTenants]);

  const filteredPlatformTenants = useMemo(() => {
    const normalizedSearch = tenantSearchTerm.trim().toLowerCase();

    const filtered = platformTenants.filter((tenant) => {
      const plan = String(tenant.plan || '').trim();
      const status = String(tenant.subscription_status || '').trim();
      const name = String(tenant.name || '').toLowerCase();
      const slug = String(tenant.slug || '').toLowerCase();

      if (tenantPlanFilter !== 'all' && plan !== tenantPlanFilter) {
        return false;
      }

      if (tenantStatusFilter !== 'all' && status !== tenantStatusFilter) {
        return false;
      }

      if (normalizedSearch && !name.includes(normalizedSearch) && !slug.includes(normalizedSearch)) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const valueA = String(a[tenantSortConfig.key] || '').toLowerCase();
      const valueB = String(b[tenantSortConfig.key] || '').toLowerCase();
      const compare = valueA.localeCompare(valueB, 'pt-BR');
      return tenantSortConfig.direction === 'asc' ? compare : -compare;
    });

    return sorted;
  }, [platformTenants, tenantPlanFilter, tenantStatusFilter, tenantSearchTerm, tenantSortConfig]);

  const toggleTenantSort = (key) => {
    setTenantSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: 'asc' };
    });
  };

  const sortIndicator = (key) => {
    if (tenantSortConfig.key !== key) {
      return '↕';
    }

    return tenantSortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const editingTenantHasAdmin = useMemo(() => {
    if (!editingTenantId) {
      return false;
    }

    return platformUsers.some((platformUser) => (
      String(platformUser.tenantId || '') === String(editingTenantId)
      && (platformUser.role === 'admin' || platformUser.role === 'owner')
    ));
  }, [platformUsers, editingTenantId]);

  const categoriasConta = useMemo(() => {
    const custom = categorias
      .filter((categoria) => categoria.scope === 'contas')
      .map((categoria) => categoria.name);

    return Array.from(new Set(custom)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categorias]);

  const categoriasInvestimento = useMemo(() => {
    const custom = categorias
      .filter((categoria) => categoria.scope === 'investimentos')
      .map((categoria) => categoria.name);

    return Array.from(new Set(custom)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categorias]);

  useEffect(() => {
    if (categoriasConta.length === 0) {
      setNovaConta((current) => ({ ...current, tipo: '' }));
      return;
    }

    if (!categoriasConta.includes(novaConta.tipo)) {
      setNovaConta((current) => ({ ...current, tipo: categoriasConta[0] }));
    }
  }, [categoriasConta, novaConta.tipo]);

  useEffect(() => {
    if (categoriasInvestimento.length === 0) {
      setNovoInvestimento((current) => ({ ...current, descricao: '' }));
      return;
    }

    if (!categoriasInvestimento.includes(novoInvestimento.descricao)) {
      setNovoInvestimento((current) => ({ ...current, descricao: categoriasInvestimento[0] }));
    }
  }, [categoriasInvestimento, novoInvestimento.descricao]);

  const distributionItems = [
    { label: 'Compras', total: relatorio.totalCompras, className: 'bg-blue-500' },
    { label: 'Contas', total: relatorio.totalContas, className: 'bg-emerald-500' },
    { label: 'Lazer', total: relatorio.totalLazer, className: 'bg-fuchsia-500' },
    { label: 'Investimentos', total: relatorio.totalInvestimentos, className: 'bg-indigo-500' },
    { label: 'Extraordinárias', total: relatorio.totalManutencoes, className: 'bg-amber-500' }
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
        <header className="relative mb-6 overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#020617_0%,#0f172a_52%,#123047_100%)] text-white shadow-[0_24px_90px_rgba(15,23,42,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_26%)]" />

          <div className="relative grid gap-8 px-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.32em] text-emerald-300">Finansam Control Center</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white">Plataforma Administrativa com visão operacional, financeira e governança por acesso.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Centralize lançamentos, usuários, categorias, estoque e relatórios em um ambiente único, com separação entre tenant e plataforma e leitura executiva da operação.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Escopo</p>
                  <p className="mt-2 text-lg font-black text-white">{isPlatformAdmin ? 'Plataforma' : 'Tenant'}</p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Perfil</p>
                  <p className="mt-2 text-lg font-black text-white">{isPlatformAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Operacional'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Status</p>
                  <p className="mt-2 text-lg font-black text-emerald-300">Sessão ativa</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Usuário ativo</p>
                  <p className="mt-2 text-2xl font-bold text-white">{user.name}</p>
                  <p className="text-sm text-slate-300">{user.email}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isAdmin ? 'bg-emerald-400/15 text-emerald-200' : 'bg-sky-400/15 text-sky-200'}`}>
                    {isPlatformAdmin ? 'Super Admin da Plataforma' : isAdmin ? 'Proprietário / Admin' : 'Usuário operacional'}
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 backdrop-blur">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Operação</p>
                  <p className="mt-2 text-lg font-black text-white">Gestão centralizada</p>
                  <p className="mt-1 text-sm text-slate-300">Dados persistidos e acesso controlado por perfil.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 backdrop-blur">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Arquitetura</p>
                  <p className="mt-2 text-lg font-black text-white">Multi contexto</p>
                  <p className="mt-1 text-sm text-slate-300">Tenant e plataforma operando com governança isolada.</p>
                </div>
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

        <nav className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95)_0%,rgba(241,245,249,0.92)_100%)] p-3 shadow-[0_18px_55px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="flex flex-wrap gap-3 rounded-[24px] border border-slate-200/80 bg-white/70 p-2">
          {(isPlatformAdmin ? platformTabs : [...tabs, ...(isAdmin ? adminTabs : [])]).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-[linear-gradient(135deg,#020617_0%,#0f172a_58%,#123047_100%)] text-white shadow-[0_14px_30px_rgba(15,23,42,0.28)]' : 'border border-slate-200/80 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <Icon size={18} className={active ? 'text-emerald-300' : 'text-slate-500'} /> {tab.label}
              </button>
            );
          })}
          </div>
        </nav>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
          <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.95)_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
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
                    {categoriasConta.length === 0 && <option value="">Cadastre categorias na aba Categorias</option>}
                    {categoriasConta.map((categoria) => (
                      <option key={categoria} value={categoria}>{categoria}</option>
                    ))}
                  </select>
                  <Field type="number" value={novaConta.valor} onChange={(value) => setNovaConta((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                  <Field type="month" value={novaConta.mes} onChange={(value) => setNovaConta((current) => ({ ...current, mes: value }))} />
                  <PrimaryButton icon={PlusCircle} onClick={adicionarConta} disabled={loading || categoriasConta.length === 0} label="Adicionar" />
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

            {activeTab === 'lazer' && (
              <div>
                <SectionHeader title="Despesas de Lazer" description="Controle mensal dos gastos com lazer e entretenimento." />
                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <Field value={novoLazer.descricao} onChange={(value) => setNovoLazer((current) => ({ ...current, descricao: value }))} placeholder="Descrição" />
                  <Field type="number" value={novoLazer.valor} onChange={(value) => setNovoLazer((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                  <Field type="month" value={novoLazer.mes} onChange={(value) => setNovoLazer((current) => ({ ...current, mes: value }))} />
                  <PrimaryButton icon={PlusCircle} onClick={adicionarLazer} disabled={loading} label="Adicionar" />
                </div>
                <FilterMonth value={mesFiltroLazer} onChange={setMesFiltroLazer} />
                <DataTable
                  headers={['Descrição', 'Valor', 'Mês', 'Ações']}
                  rows={lazer.filter((item) => item.mes === mesFiltroLazer).map((item) => [
                    item.descricao,
                    formatCurrency(item.valor),
                    item.mes,
                    isAdmin ? (
                      <DangerTextButton key={`delete-lazer-${item.id}`} onClick={() => excluirRegistro(`/lazer/${item.id}`, 'Despesa de lazer excluída com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-lazer-${item.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhuma despesa de lazer registrada para este mês"
                />
              </div>
            )}

            {activeTab === 'manutencoes' && (
              <div>
                <SectionHeader title="Extraordinárias" description="Custos ocasionais separados das contas fixas." />
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
                      <DangerTextButton key={`delete-manutencao-${manutencao.id}`} onClick={() => excluirRegistro(`/manutencoes/${manutencao.id}`, 'Despesa extraordinária excluída com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-manutencao-${manutencao.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhuma manutenção registrada para este mês"
                />
              </div>
            )}

            {activeTab === 'investimentos' && (
              <div>
                <SectionHeader title="Investimentos" description="Aportes mensais de investimentos e reservas." />
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <select
                      value={novoInvestimento.descricao}
                      onChange={(event) => setNovoInvestimento((current) => ({ ...current, descricao: event.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    >
                      {categoriasInvestimento.length === 0 && <option value="">Cadastre categorias na aba Categorias</option>}
                      {categoriasInvestimento.map((categoria) => (
                        <option key={categoria} value={categoria}>{categoria}</option>
                      ))}
                    </select>
                    <Field type="number" value={novoInvestimento.valor} onChange={(value) => setNovoInvestimento((current) => ({ ...current, valor: value }))} placeholder="Valor" />
                    <Field type="month" value={novoInvestimento.mes} onChange={(value) => setNovoInvestimento((current) => ({ ...current, mes: value }))} />
                    <PrimaryButton icon={PlusCircle} onClick={adicionarInvestimento} disabled={loading || categoriasInvestimento.length === 0} label="Adicionar" />
                  </div>
                  <Field value={novoInvestimento.nota} onChange={(value) => setNovoInvestimento((current) => ({ ...current, nota: value }))} placeholder="Descrição (opcional)" />
                </div>
                <FilterMonth value={mesFiltroInvestimentos} onChange={setMesFiltroInvestimentos} />
                <DataTable
                  headers={['Categoria', 'Valor', 'Descrição', 'Mês', 'Ações']}
                  rows={investimentos.filter((investimento) => investimento.mes === mesFiltroInvestimentos).map((investimento) => [
                    investimento.descricao,
                    formatCurrency(investimento.valor),
                    investimento.nota || '-',
                    investimento.mes,
                    isAdmin ? (
                      <DangerTextButton key={`delete-investimento-${investimento.id}`} onClick={() => excluirRegistro(`/investimentos/${investimento.id}`, 'Investimento excluído com sucesso')} label="Excluir" />
                    ) : (
                      <span key={`readonly-investimento-${investimento.id}`} className="text-sm text-slate-400">Somente admin exclui</span>
                    )
                  ])}
                  emptyMessage="Nenhum investimento registrado para este mês"
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
                  <MetricCard title="Lazer" value={formatCurrency(relatorio.totalLazer)} tone="bg-fuchsia-100 text-fuchsia-900" />
                  <MetricCard title="Investimentos" value={formatCurrency(relatorio.totalInvestimentos)} tone="bg-indigo-100 text-indigo-900" />
                  <MetricCard title="Extraordinárias" value={formatCurrency(relatorio.totalManutencoes)} tone="bg-amber-100 text-amber-900" />
                  <MetricCard title="Total Geral" value={formatCurrency(relatorio.totalGeral)} tone="bg-rose-100 text-rose-900" />
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
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

                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
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
                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
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

                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} />
                      <h3 className="text-lg font-bold">Diagnóstico e migração</h3>
                    </div>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      <li>Antes, o frontend persistia tudo em localStorage. Isso impedia governança central, auditoria e acesso por múltiplos usuários.</li>
                      <li>Agora, login e autorização passam pelo backend, com token JWT e dados persistidos no PostgreSQL.</li>
                      <li>Existe exatamente um administrador proprietário. Usuários adicionais são sempre operacionais.</li>
                      <li>Exclusões de compras, contas e extraordinárias ficam restritas ao proprietário para reduzir risco operacional.</li>
                      <li>Os registros antigos em localStorage não são migrados automaticamente. Se houver dados no navegador antigo, eles precisam ser importados manualmente.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
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

            {activeTab === 'categories' && isAdmin && (
              <div>
                <SectionHeader title="Gerenciamento de Categorias" description="Cadastre categorias reutilizáveis para contas e investimentos." />

                <div className="mt-6 space-y-6">
                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                    <h3 className="text-lg font-bold">Categorias de Contas</h3>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row">
                      <Field value={novaCategoriaConta} onChange={setNovaCategoriaConta} placeholder="Nome da categoria" />
                      <PrimaryButton icon={PlusCircle} onClick={() => adicionarCategoria('contas', novaCategoriaConta)} disabled={loading} label="Adicionar" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categorias.filter((categoria) => categoria.scope === 'contas').map((categoria) => (
                        <button
                          key={categoria.id}
                          type="button"
                          onClick={() => excluirCategoria(categoria.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          {categoria.name} <Trash2 size={14} />
                        </button>
                      ))}
                      {categorias.filter((categoria) => categoria.scope === 'contas').length === 0 && (
                        <p className="text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                    <h3 className="text-lg font-bold">Categorias de Investimentos</h3>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row">
                      <Field value={novaCategoriaInvestimento} onChange={setNovaCategoriaInvestimento} placeholder="Nome da categoria" />
                      <PrimaryButton icon={PlusCircle} onClick={() => adicionarCategoria('investimentos', novaCategoriaInvestimento)} disabled={loading} label="Adicionar" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categorias.filter((categoria) => categoria.scope === 'investimentos').map((categoria) => (
                        <button
                          key={categoria.id}
                          type="button"
                          onClick={() => excluirCategoria(categoria.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          {categoria.name} <Trash2 size={14} />
                        </button>
                      ))}
                      {categorias.filter((categoria) => categoria.scope === 'investimentos').length === 0 && (
                        <p className="text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'platform' && isPlatformAdmin && (
              <div>
                <SectionHeader title="Administração da Plataforma" description="Gerencie empresas (tenants) e usuários globais da ferramenta." />

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">Criar tenant</h3>
                    {!showCreateTenantForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateTenantForm(true);
                          clearMessages();
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 font-semibold text-white transition hover:bg-slate-800"
                      >
                        <PlusCircle size={14} /> Novo tenant
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateTenantForm(false);
                          setCreateTenantForm(emptyCreateTenantForm());
                          clearMessages();
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {showCreateTenantForm && (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field value={createTenantForm.firstName} onChange={(value) => setCreateTenantForm((current) => ({ ...current, firstName: value }))} placeholder="Nome *" />
                        <Field value={createTenantForm.lastName} onChange={(value) => setCreateTenantForm((current) => ({ ...current, lastName: value }))} placeholder="Sobrenome" />
                        <Field value={createTenantForm.company} onChange={(value) => setCreateTenantForm((current) => ({ ...current, company: value }))} placeholder="Empresa" />
                        <select
                          value={createTenantForm.plan}
                          onChange={(event) => setCreateTenantForm((current) => ({ ...current, plan: event.target.value }))}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        >
                          {TENANT_PLANS.map((planOption) => (
                            <option key={planOption} value={planOption}>{planOption}</option>
                          ))}
                        </select>
                        <select
                          value={createTenantForm.status}
                          onChange={(event) => setCreateTenantForm((current) => ({ ...current, status: event.target.value }))}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        >
                          {TENANT_STATUSES.map((statusOption) => (
                            <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                          ))}
                        </select>
                        <Field value={createTenantForm.phone} onChange={(value) => setCreateTenantForm((current) => ({ ...current, phone: value }))} placeholder="Telefone *" />
                        <Field type="email" value={createTenantForm.email} onChange={(value) => setCreateTenantForm((current) => ({ ...current, email: value }))} placeholder="Email *" />
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={createTenantForm.createAdminUser}
                            onChange={(event) => setCreateTenantForm((current) => ({ ...current, createAdminUser: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Criar usuário admin no cadastro do tenant
                        </label>

                        {createTenantForm.createAdminUser && (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <Field
                              type="email"
                              value={createTenantForm.adminEmail}
                              onChange={(value) => setCreateTenantForm((current) => ({ ...current, adminEmail: value }))}
                              placeholder="E-mail do admin *"
                            />
                            <Field
                              type="password"
                              value={createTenantForm.adminPassword}
                              onChange={(value) => setCreateTenantForm((current) => ({ ...current, adminPassword: value }))}
                              placeholder="Senha do admin *"
                            />
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Campos com * são obrigatórios. Sobrenome e Empresa são opcionais.</p>
                      <div className="mt-4">
                        <PrimaryButton
                          icon={PlusCircle}
                          onClick={criarTenantComFormulario}
                          disabled={loading}
                          label="Criar tenant"
                        />
                      </div>
                    </>
                  )}
                </div>

                {editingTenantId && (
                  <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold">Editar tenant</h3>
                      <button
                        type="button"
                        onClick={cancelarEdicaoTenant}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Cancelar edição
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <Field value={editTenantForm.firstName} onChange={(value) => setEditTenantForm((current) => ({ ...current, firstName: value }))} placeholder="Nome *" />
                      <Field value={editTenantForm.lastName} onChange={(value) => setEditTenantForm((current) => ({ ...current, lastName: value }))} placeholder="Sobrenome" />
                      <Field value={editTenantForm.company} onChange={(value) => setEditTenantForm((current) => ({ ...current, company: value }))} placeholder="Empresa" />
                      <select
                        value={editTenantForm.plan}
                        onChange={(event) => setEditTenantForm((current) => ({ ...current, plan: event.target.value }))}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      >
                        {TENANT_PLANS.map((planOption) => (
                          <option key={planOption} value={planOption}>{planOption}</option>
                        ))}
                      </select>
                      <select
                        value={editTenantForm.status}
                        onChange={(event) => setEditTenantForm((current) => ({ ...current, status: event.target.value }))}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      >
                        {TENANT_STATUSES.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                        ))}
                      </select>
                      <Field value={editTenantForm.phone} onChange={(value) => setEditTenantForm((current) => ({ ...current, phone: value }))} placeholder="Telefone *" />
                      <Field type="email" value={editTenantForm.email} onChange={(value) => setEditTenantForm((current) => ({ ...current, email: value }))} placeholder="Email *" />
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {editingTenantHasAdmin ? 'Ação detectada: reset de admin existente' : 'Ação detectada: criação de admin para o tenant'}
                      </p>
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={editTenantForm.createAdminUser}
                          onChange={(event) => setEditTenantForm((current) => ({ ...current, createAdminUser: event.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Criar ou resetar usuário admin do tenant
                      </label>

                      {editTenantForm.createAdminUser && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field
                            type="email"
                            value={editTenantForm.adminEmail}
                            onChange={(value) => setEditTenantForm((current) => ({ ...current, adminEmail: value }))}
                            placeholder="E-mail do admin *"
                          />
                          <Field
                            type="password"
                            value={editTenantForm.adminPassword}
                            onChange={(value) => setEditTenantForm((current) => ({ ...current, adminPassword: value }))}
                            placeholder="Senha do admin *"
                          />
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Campos com * são obrigatórios. Sobrenome e Empresa são opcionais.</p>
                    <div className="mt-4">
                      <PrimaryButton
                        icon={PlusCircle}
                        onClick={salvarTenant}
                        disabled={loading}
                        label="Salvar alterações"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold">Tenants cadastrados</h3>
                      <span className="text-sm font-semibold text-slate-600">
                        {filteredPlatformTenants.length} de {platformTenants.length} tenants
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <input
                        type="text"
                        value={tenantSearchTerm}
                        onChange={(event) => setTenantSearchTerm(event.target.value)}
                        placeholder="Buscar por nome ou slug"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />
                      <select
                        value={tenantPlanFilter}
                        onChange={(event) => setTenantPlanFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="all">Todos os planos</option>
                        {tenantPlanOptions.map((plan) => (
                          <option key={plan} value={plan}>{plan}</option>
                        ))}
                      </select>
                      <select
                        value={tenantStatusFilter}
                        onChange={(event) => setTenantStatusFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="all">Todos os status</option>
                        {tenantStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setTenantSearchTerm('');
                          setTenantPlanFilter('all');
                          setTenantStatusFilter('all');
                          setTenantSortConfig(defaultTenantSort());
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto px-5 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleTenantSort('name')}
                              className="inline-flex items-center gap-1 transition hover:text-slate-800"
                            >
                              Nome <span>{sortIndicator('name')}</span>
                            </button>
                          </th>
                          <th className="pb-3 pr-4 font-semibold">Slug</th>
                          <th className="pb-3 pr-4 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleTenantSort('plan')}
                              className="inline-flex items-center gap-1 transition hover:text-slate-800"
                            >
                              Plano <span>{sortIndicator('plan')}</span>
                            </button>
                          </th>
                          <th className="pb-3 pr-4 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleTenantSort('subscription_status')}
                              className="inline-flex items-center gap-1 transition hover:text-slate-800"
                            >
                              Status <span>{sortIndicator('subscription_status')}</span>
                            </button>
                          </th>
                          <th className="pb-3 pr-4 font-semibold">Usuários</th>
                          <th className="pb-3 pr-4 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPlatformTenants.map((tenant) => (
                          <tr key={tenant.id} className="border-t border-slate-100 align-top">
                            <td className="py-4 pr-4 font-semibold text-slate-800">{tenant.name}</td>
                            <td className="py-4 pr-4 text-slate-600">{tenant.slug}</td>
                            <td className="py-4 pr-4 text-slate-600">{tenant.plan || '-'}</td>
                            <td className="py-4 pr-4 text-slate-600">{tenant.subscription_status || '-'}</td>
                            <td className="py-4 pr-4 text-slate-600">{tenant.users_count ?? 0}</td>
                            <td className="py-4 pr-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicaoTenant(tenant)}
                                  disabled={loading}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Pencil size={14} /> Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => excluirTenantPlataforma(tenant.id, tenant.slug)}
                                  disabled={tenant.is_protected || loading}
                                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 size={14} /> {tenant.is_protected ? 'Tenant protegido' : 'Excluir tenant'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredPlatformTenants.length === 0 && (
                          <tr>
                            <td className="py-5 text-center text-slate-500" colSpan={6}>Nenhum tenant encontrado com os filtros atuais</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-lg font-bold">Super admins da plataforma</h3>
                  </div>
                  <div className="overflow-x-auto px-5 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">Nome</th>
                          <th className="pb-3 pr-4 font-semibold">E-mail</th>
                          <th className="pb-3 pr-4 font-semibold">Status</th>
                          <th className="pb-3 pr-4 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platformAdmins.map((platformAdmin) => {
                          const isCurrentAdmin = String(platformAdmin.id) === String(user?.id);

                          return (
                            <tr key={platformAdmin.id} className="border-t border-slate-100 align-top">
                              <td className="py-4 pr-4 font-semibold text-slate-800">{platformAdmin.name}</td>
                              <td className="py-4 pr-4 text-slate-600">{platformAdmin.email}</td>
                              <td className="py-4 pr-4 text-slate-600">{platformAdmin.active ? 'Ativo' : 'Inativo'}</td>
                              <td className="py-4 pr-4">
                                <button
                                  type="button"
                                  onClick={() => excluirAdminPlataforma(platformAdmin.id, platformAdmin.email)}
                                  disabled={isCurrentAdmin || loading}
                                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 size={14} /> {isCurrentAdmin ? 'Conta logada protegida' : 'Excluir admin'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {platformAdmins.length === 0 && (
                          <tr>
                            <td className="py-5 text-center text-slate-500" colSpan={4}>Nenhum super admin encontrado</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-lg font-bold">Usuários da plataforma</h3>
                  </div>
                  <div className="overflow-x-auto px-5 py-4">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 pr-4 font-semibold">Nome</th>
                          <th className="pb-3 pr-4 font-semibold">E-mail</th>
                          <th className="pb-3 pr-4 font-semibold">Papel</th>
                          <th className="pb-3 pr-4 font-semibold">Tenant</th>
                          <th className="pb-3 pr-4 font-semibold">Status</th>
                          <th className="pb-3 pr-4 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platformUsers.map((registeredUser) => (
                          <tr key={registeredUser.id} className="border-t border-slate-100 align-top">
                            <td className="py-4 pr-4 font-semibold text-slate-800">{registeredUser.name}</td>
                            <td className="py-4 pr-4 text-slate-600">{registeredUser.email}</td>
                            <td className="py-4 pr-4 text-slate-600">{registeredUser.role}</td>
                            <td className="py-4 pr-4 text-slate-600">{registeredUser.tenantName || '-'}</td>
                            <td className="py-4 pr-4 text-slate-600">{registeredUser.active ? 'Ativo' : 'Inativo'}</td>
                            <td className="py-4 pr-4">
                              <button
                                type="button"
                                onClick={() => excluirUsuarioPlataforma(registeredUser.id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white transition hover:bg-rose-700"
                              >
                                <Trash2 size={14} /> Excluir usuário
                              </button>
                            </td>
                          </tr>
                        ))}
                        {platformUsers.length === 0 && (
                          <tr>
                            <td className="py-5 text-center text-slate-500" colSpan={6}>Nenhum usuário encontrado</td>
                          </tr>
                        )}
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
                {!isPlatformAdmin && <SummaryRow label="Contas cadastradas" value={String(contas.length)} />}
                {!isPlatformAdmin && <SummaryRow label="Investimentos" value={String(investimentos.length)} />}
                {!isPlatformAdmin && <SummaryRow label="Extraordinárias" value={String(manutencoes.length)} />}
                {!isPlatformAdmin && <SummaryRow label="Itens em estoque" value={String(estoque.length)} />}
                {isAdmin && <SummaryRow label="Usuários ativos" value={String(usuarios.filter((registeredUser) => registeredUser.active).length)} />}
                {isPlatformAdmin && <SummaryRow label="Tenants" value={String(platformTenants.length)} />}
                {isPlatformAdmin && <SummaryRow label="Usuários globais" value={String(platformUsers.length)} />}
                {isPlatformAdmin && <SummaryRow label="Super admins" value={String(platformAdmins.length)} />}
              </div>
            </div>
          </aside>
        </section>

        <footer className="relative mt-8 overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#020617_0%,#0f172a_55%,#123047_100%)] px-6 py-5 text-white shadow-[0_24px_90px_rgba(15,23,42,0.28)] md:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_26%)]" />

          <div className="relative flex flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <a
              href="https://smcorp.com.br"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-300 transition hover:text-emerald-300"
            >
              Powered By SMCorp
            </a>
            <p>Finansam {new Date().getFullYear()} • Plataforma administrativa com padrão corporativo</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FinanceApp;

# finansam

Aplicação de controle financeiro doméstico com backend em Node.js, PostgreSQL e frontend React.

## O que mudou

O projeto agora cobre os três pontos pedidos:

1. Diagnóstico do estado anterior: o frontend antigo salvava tudo em `localStorage`, sem autenticação, sem perfis e sem portal administrativo.
2. Autenticação e papéis: existe login com JWT, dados centralizados no PostgreSQL e separação entre `admin` proprietário e `user` operacional.
3. Portal administrativo: o proprietário pode criar usuários, desativar contas operacionais e redefinir senhas.

## Papéis e permissões

- `admin`: proprietário da ferramenta. Pode acessar o portal administrativo, gerenciar usuários e excluir compras, contas e manutenções.
- `user`: usuário operacional. Pode criar compras, contas, manutenções e registrar baixa de estoque.

### Administração global da plataforma

- `super_admin`: usuário global da ferramenta (fora do tenant). Pode listar e excluir tenants, além de remover usuários de qualquer tenant.
- O super admin acessa a aba `Plataforma` no frontend.
- As ações globais usam endpoints dedicados em `/api/platform/*`.
- Proteção ativa: o tenant padrão inicial (`ADMIN_TENANT_SLUG`) não pode ser excluído.
- Proteção ativa: o super admin logado não pode excluir a própria conta.
- Confirmação forte: para exclusão de tenant é obrigatório digitar o slug; para exclusão de super admin é obrigatório digitar o e-mail.

Existe somente um administrador proprietário. Usuários adicionais sempre são criados como `user`.

## Credenciais iniciais do administrador

As credenciais iniciais são semeadas pelo backend na primeira subida da aplicação, usando as variáveis do serviço `backend` no `docker-compose.yml`:

- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

Para o administrador global da plataforma:

- `PLATFORM_ADMIN_NAME`
- `PLATFORM_ADMIN_EMAIL`
- `PLATFORM_ADMIN_PASSWORD`

Quando o esquema multi-tenant estiver ativo:

- `ADMIN_TENANT_NAME`
- `ADMIN_TENANT_SLUG`

Troque esses valores antes de qualquer uso real.

## Como subir com Docker

```bash
docker compose up --build
```

Serviços padrão:

- Frontend: `http://localhost`
- Backend: `http://localhost:3001`
- Banco: `localhost:5432`

## Fluxo de uso

1. Suba a stack.
2. Entre no frontend com o `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados.
3. Abra a aba `Portal Admin` para criar usuários operacionais.
4. Usuários operacionais podem lançar dados e movimentar estoque, mas não excluir registros críticos.

## Observação sobre dados antigos

Os dados antigos que existiam apenas no navegador não são migrados automaticamente. Se você tinha registros guardados no `localStorage`, será necessário reimportá-los manualmente para o backend.
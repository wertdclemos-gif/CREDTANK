# CredTank — código para versionamento

Pacote baseado em CredTank_public_html_ADMIN_RELATORIOS_FILTROS_ORDENACAO.zip (09/10/2026).

## Configuração privada

O pacote não inclui credenciais do MySQL, SMTP ou gateways, nem cadastros de demonstração. Configure as variáveis listadas em `api/config.php` no servidor ou copie `api/config.local.example.php` para `api/config.local.php` e preencha os valores privadamente. O arquivo local é ignorado pelo Git. Arquivos .env não são carregados automaticamente.

Os usuários e maquininhas existentes são carregados do banco configurado. Não há criação automática de administrador com senha padrão. Uma instalação com banco vazio exige provisionamento administrativo seguro fora deste pacote.

## Publicação no GitHub

Envie somente o conteúdo deste pacote. Não inclua o ZIP original, exports SQL/Excel, backups, logs nem configuração privada. O SQL incluído contém somente estrutura, sem registros de produção.

Esta limpeza é dos arquivos para versionamento. Não altera dados, senhas nem transações no servidor. Para instalar a versão limpa no servidor, configure primeiro as credenciais privadas.

Se credenciais já tiverem sido publicadas ou compartilhadas com terceiros, substitua-as nos serviços correspondentes. Remover arquivos ou adicionar .gitignore não remove segredos do histórico Git. Este pacote não contém histórico Git.

## Limites da revisão

Foram removidas credenciais e cadastros estáticos e revisados os arquivos textuais do pacote. Isso não é uma auditoria completa da autenticação, autorização ou segurança em produção. O sistema ainda contém rotinas de estado e autenticação existentes, que exigem avaliação independente antes de exposição pública em produção.

O QR usa um checksum calculado no navegador com um salt público de compatibilidade (`QR_CHECKSUM_SALT`). Esse valor não oferece autenticação criptográfica nem pode ser tratado como segredo. Foi preservado para não invalidar o protocolo existente; migrar a validação de QR para assinatura no servidor exige uma atualização de segurança própria.

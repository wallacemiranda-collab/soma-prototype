import { ArrowLeft, Bell, Download, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import { Card, PrimaryButton } from '../components/ui'
import { usePhase3Pwa } from '../contexts/Phase3PwaContext'
import { useAuth } from '../contexts/AuthContext'

export default function InstallPreview() {
  const { installed, canInstall, install, message, pending, worker } =
    usePhase3Pwa()
  const { isDemo } = useAuth()
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] bg-mist px-5 py-7 text-soma-900">
      <header className="mb-7 flex items-center justify-between">
        <Link
          to={isDemo ? '/home' : '/login'}
          aria-label="Voltar"
          className="rounded-xl bg-white p-3"
        >
          <ArrowLeft size={20} />
        </Link>
        <BrandMark compact />
      </header>
      <Smartphone size={32} aria-hidden="true" className="text-soma-500" />
      <h1 className="mt-4 text-3xl font-semibold">
        Endo + na sua tela inicial
      </h1>
      <p className="mt-3 text-sm leading-6 text-soma-600">
        Instale esta prévia separada para experimentar o acesso pelo ícone. Ela
        não substitui o aplicativo oficial e usa somente dados fictícios.
      </p>
      <Card className="mt-6">
        <h2 className="font-semibold">Instalação neste aparelho</h2>
        {installed ? (
          <p role="status" className="mt-3 text-sm">
            Esta prévia já está aberta como aplicativo.
          </p>
        ) : canInstall ? (
          <PrimaryButton
            type="button"
            onClick={install}
            disabled={pending}
            className="mt-4 gap-2"
          >
            <Download size={18} aria-hidden="true" />
            {pending ? 'Aguarde...' : 'Instalar prévia'}
          </PrimaryButton>
        ) : (
          <p className="mt-3 text-sm leading-6 text-soma-600">
            Se o botão de instalação não aparecer, use o menu do navegador
            conforme as orientações abaixo. Isso não significa que a instalação
            falhou.
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
        {worker === 'unavailable' && (
          <p className="mt-3 text-sm text-soma-600">
            Este navegador não conseguiu preparar o aplicativo. Você pode
            continuar usando a prévia online.
          </p>
        )}
      </Card>
      <Card className="mt-4">
        <h2 className="font-semibold">iPhone ou iPad</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-soma-600">
          <li>Abra este mesmo link no Safari.</li>
          <li>Toque em Compartilhar e procure Adicionar à Tela de Início.</li>
          <li>Confirme e abra o ícone Endo + Prévia na tela inicial.</li>
        </ol>
      </Card>
      <Card className="mt-4">
        <h2 className="font-semibold">Android</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-soma-600">
          <li>Abra este mesmo link no Chrome.</li>
          <li>
            No menu de três pontos, procure Instalar aplicativo ou Adicionar à
            tela inicial.
          </li>
          <li>Confirme e abra o ícone Endo + Prévia.</li>
        </ol>
      </Card>
      <p className="mt-5 text-sm leading-6 text-soma-600">
        Abra primeiro o link temporário de revisão neste navegador. Em alguns
        aparelhos, o ícone pode solicitar acesso novamente. Os ajustes fictícios
        desta aba não são transferidos automaticamente para o aplicativo instalado.
      </p>
      <p className="mt-5 text-sm leading-6 text-soma-600">
        É preciso estar conectado para usar as telas. Esta etapa não guarda
        registros de saúde offline. Sem conexão, aparece somente uma orientação
        para reconectar.
      </p>
      <Link
        to={isDemo ? '/lembretes' : '/login'}
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-soma-800 px-4 py-4 font-semibold text-white"
      >
        <Bell size={18} aria-hidden="true" />
        {isDemo ? 'Experimentar lembretes' : 'Abrir a demonstração'}
      </Link>
      <p className="mt-4 text-xs leading-5 text-soma-600">
        Nenhuma permissão de notificações será solicitada nesta prévia. O envio
        real será uma etapa posterior.
      </p>
    </main>
  )
}

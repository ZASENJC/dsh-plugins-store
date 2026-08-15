import * as React from 'react'
import {
  Button,
  IconCheckOutline16,
  IconCloseOutline16,
  IconCopyOutline16,
  IconCordisPluginOutline14,
  IconDownloadOutline16,
  IconRefreshOutline16,
  IconWarningOutline16,
  Modal,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CATEGORY_LABELS,
  PROJECT_TYPE_LABELS,
  VALIDATION_STATUS_IDS,
  buildInstallCommand,
  buildInstallPlan,
  filterCatalogRepositories,
  formatCompactNumber,
} from './catalog.js'
import { sendInstallFailureToAgent } from './agent-analysis.js'

const PAGE_SIZE = 24

function buildExternalInstallTarget(request, repositories) {
  const repositoryId = typeof request === 'string' ? request : request?.repositoryId
  if (typeof repositoryId !== 'string') return null
  const byId = repositories.find((repository) => (
    String(repository.id ?? `github:${repository.repositoryId}`) === repositoryId
  ))
  return byId !== undefined && buildInstallPlan(byId) !== null ? byId : null
}

function ProjectCard({ repository, copied, installed, onCopy, onInstall, t }) {
  const command = buildInstallCommand(repository)
  const plan = buildInstallPlan(repository)
  const detailUrl = `https://dsh.aitreez.com/plugins/${repository.repositoryId}`
  const validationState = repository.validation?.overall
    ?? (repository.verified ? 'recorded' : 'check-pending')
  const validationReason = repository.validation?.reason

  return (
    <article className="dps-card">
      <a
        className="dps-card-link"
        href={detailUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${t('store.openDetails')}: ${repository.fullName}`}
        title={t('store.openDetails')}
      />
      <div className="dps-card-head">
        <div className="dps-card-title">
          <h3 title={repository.name}>{repository.name}</h3>
        </div>
        <span className="dps-stars">{t('store.stars', { count: formatCompactNumber(repository.stars) })}</span>
      </div>
      <p className="dps-card-repo" title={repository.fullName}>{repository.fullName}</p>
      <p className="dps-card-description">{repository.description}</p>
      {validationReason && (validationState === 'expired' || validationState === 'security-review') && (
        <p className="dps-validation-reason">{validationReason}</p>
      )}
      <div className="dps-badges">
        <span className="dps-badge" data-kind="validation" data-status={validationState}>
          {t(`store.validation.${validationState}`)}
        </span>
        <span className="dps-badge">{CATEGORY_LABELS[repository.category] ?? CATEGORY_LABELS.other}</span>
        <span className="dps-badge">{PROJECT_TYPE_LABELS[repository.projectType] ?? repository.projectType}</span>
      </div>
      <div className="dps-card-foot">
        <div className="dps-install-reference">
          <IconCordisPluginOutline14 size={14} />
          <code title={command ?? t('store.topicListed')}>{command ?? t('store.topicListed')}</code>
        </div>
        {command !== null && (
          <div className="dps-card-actions">
            {plan !== null && (
              <Button
                className="dps-install-button"
                size="sm"
                variant="outline"
                type="button"
                disabled={installed}
                onClick={() => onInstall(repository)}
              >
                {installed ? <IconCheckOutline16 size={14} /> : <IconDownloadOutline16 size={14} />}
                <span>{installed ? t('store.installed') : t('store.install')}</span>
              </Button>
            )}
            <button
              className="dps-icon-button"
              type="button"
              onClick={() => onCopy(repository.repositoryId, command)}
              aria-label={copied ? t('store.copied') : t('store.copyInstall')}
              title={copied ? t('store.copied') : t('store.copyInstall')}
            >
              {copied ? <IconCheckOutline16 size={16} /> : <IconCopyOutline16 size={16} />}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function InstallRiskModal({ target, onClose, onInstalled, sessions, workspaces, t }) {
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [phase, setPhase] = React.useState('idle')
  const [message, setMessage] = React.useState('')
  const [analysisPhase, setAnalysisPhase] = React.useState('idle')

  React.useEffect(() => {
    setAcknowledged(false)
    setPhase('idle')
    setMessage('')
    setAnalysisPhase('idle')
  }, [target?.repositoryId])

  const plan = target === null ? null : buildInstallPlan(target)
  const command = plan?.command ?? (target === null ? '' : buildInstallCommand(target))
  const finished = phase === 'success'

  const close = () => {
    if (phase !== 'installing') onClose()
  }

  const install = async () => {
    if (target === null || !acknowledged || phase === 'installing') return
    if (plan === null) return
    setPhase('installing')
    setMessage('')
    try {
      const response = await fetch('/api/dsh-plugin-store/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryId: target.id ?? `github:${target.repositoryId}`,
          install: plan,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true) {
        throw new Error(body.message ?? `${t('store.installFailed')} (${response.status})`)
      }
      setPhase('success')
      setMessage(body.output ?? '')
      onInstalled(target.repositoryId)
    } catch (error) {
      setPhase('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const analyzeWithAgent = async () => {
    if (target === null || phase !== 'error' || analysisPhase === 'sending' || analysisPhase === 'sent') return
    setAnalysisPhase('sending')
    try {
      await sendInstallFailureToAgent({
        sessions,
        workspaces,
        fullName: target.fullName,
        install: plan,
        error: message,
      })
      setAnalysisPhase('sent')
    } catch (error) {
      setAnalysisPhase('error')
      setMessage((current) => `${current}\n${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={close}
      title={t('store.riskTitle')}
      closeLabel={t('store.cancel')}
      className="dps-risk-modal"
      headless
    >
      {target !== null && (
        <div className="dps-risk-shell">
          <header className="dps-risk-header">
            <div className="dps-risk-title">
              <IconWarningOutline16 size={18} />
              <h2>{t('store.riskTitle')}</h2>
            </div>
            <button
              className="dps-icon-button"
              type="button"
              onClick={close}
              disabled={phase === 'installing'}
              aria-label={t('store.cancel')}
              title={t('store.cancel')}
            >
              <IconCloseOutline16 size={16} />
            </button>
          </header>
          <div className="dps-risk-body">
            <strong>{t('store.riskLead')}</strong>
            <p>{t('store.riskDetail')}</p>
            <div className="dps-risk-repository">
              <span>{target.fullName}</span>
              <code>{command}</code>
            </div>
            {!finished && (
              <label className="dps-risk-acknowledge">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={phase === 'installing'}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>{t('store.riskAcknowledge')}</span>
              </label>
            )}
            {phase === 'installing' && <p className="dps-install-status" role="status">{t('store.installing')}</p>}
            {phase === 'success' && <p className="dps-install-status" data-kind="success" role="status">{t('store.installSuccess')}</p>}
            {phase === 'error' && (
              <p className="dps-install-status" data-kind="error" role="alert">
                <strong>{t('store.installFailed')}</strong>
                <span>{message}</span>
              </p>
            )}
            {phase === 'error' && (
              <p className="dps-install-analysis" role="status">
                {analysisPhase === 'sent' ? t('store.analyzeSent') : analysisPhase === 'sending' ? t('store.analyzing') : analysisPhase === 'error' ? t('store.analyzeFailed') : t('store.analyzeHint')}
              </p>
            )}
            {phase === 'success' && message && <pre className="dps-install-output">{message}</pre>}
          </div>
          <footer className="dps-risk-actions">
            {finished ? (
              <Button size="sm" variant="outline" type="button" onClick={close}>{t('store.done')}</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" type="button" disabled={phase === 'installing'} onClick={close}>
                  {t('store.cancel')}
                </Button>
                {phase === 'error' && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={analysisPhase === 'sending' || analysisPhase === 'sent'}
                    onClick={analyzeWithAgent}
                  >
                    {analysisPhase === 'sent' ? t('store.analyzeSent') : t('store.analyzeWithAgent')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  disabled={!acknowledged || plan === null || phase === 'installing'}
                  onClick={install}
                >
                  {phase === 'installing' ? t('store.installing') : t('store.confirmInstall')}
                </Button>
              </>
            )}
          </footer>
        </div>
      )}
    </Modal>
  )
}

export function StoreView({
  catalogStore,
  mode,
  requestedInstallTarget = null,
  onInstallRequestConsumed,
  sessions,
  workspaces,
  t,
}) {
  const snapshot = React.useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getSnapshot,
  )
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [validation, setValidation] = React.useState('all')
  const [sort, setSort] = React.useState('recommended')
  const [verifiedOnly, setVerifiedOnly] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [copiedId, setCopiedId] = React.useState(null)
  const [installTarget, setInstallTarget] = React.useState(null)
  const [installedIds, setInstalledIds] = React.useState(() => new Set())

  React.useEffect(() => {
    catalogStore.load()
  }, [catalogStore])

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, category, validation, sort, verifiedOnly])

  const repositories = snapshot.catalog?.repositories ?? []
  React.useEffect(() => {
    const target = buildExternalInstallTarget(requestedInstallTarget, repositories)
    if (target !== null) setInstallTarget(target)
  }, [requestedInstallTarget, repositories])

  const filtered = React.useMemo(() => filterCatalogRepositories(repositories, {
    query,
    category,
    validation,
    sort,
    verifiedOnly,
  }), [repositories, query, category, validation, sort, verifiedOnly])
  const visible = filtered.slice(0, visibleCount)
  const generatedAt = snapshot.catalog?.generatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(snapshot.catalog.generatedAt))
    : null

  const copyInstall = async (repositoryId, command) => {
    if (!await writeClipboard(command)) return
    setCopiedId(repositoryId)
    window.setTimeout(() => setCopiedId((current) => (
      current === repositoryId ? null : current
    )), 1600)
  }

  const refresh = () => catalogStore.load({ force: true })
  const closeInstallTarget = () => {
    setInstallTarget(null)
    onInstallRequestConsumed?.()
  }

  return (
    <>
      <section className="dps-store" data-mode={mode} aria-label={t('header.title')}>
      <div className="dps-store-head">
        <div className="dps-store-meta">
          <p>{t('store.results', { visible: visible.length, total: filtered.length })}</p>
          {generatedAt && <p>{t('store.updated', { date: generatedAt })}</p>}
          <p className="dps-disclaimer">{t('store.disclaimer')}</p>
        </div>
        <button
          className="dps-icon-button"
          type="button"
          onClick={refresh}
          aria-label={t('store.refresh')}
          title={t('store.refresh')}
          disabled={snapshot.status === 'loading'}
        >
          <IconRefreshOutline16 size={16} />
        </button>
      </div>

      <div className="dps-filter-bar">
        <label className="dps-filter dps-filter-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('store.search')}
            aria-label={t('store.search')}
          />
        </label>
        <label className="dps-filter">
          <select
            value={validation}
            onChange={(event) => setValidation(event.target.value)}
            aria-label={t('store.validation')}
          >
            <option value="all">{t('store.validation.all')}</option>
            {VALIDATION_STATUS_IDS.map((value) => (
              <option key={value} value={value}>{t(`store.validation.${value}`)}</option>
            ))}
          </select>
        </label>
        <label className="dps-filter">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label={t('store.category')}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="dps-filter">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label={t('store.sort')}
          >
            <option value="recommended">{t('store.sortRecommended')}</option>
            <option value="stars">{t('store.sortStars')}</option>
            <option value="updated">{t('store.sortUpdated')}</option>
            <option value="name">{t('store.sortName')}</option>
          </select>
        </label>
        <label className="dps-check">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
          />
          <span>{t('store.verifiedOnly')}</span>
        </label>
      </div>

      <div className="dps-catalog-scroll">
        {snapshot.status === 'loading' && snapshot.catalog === null && (
          <div className="dps-loading" role="status">{t('store.loading')}</div>
        )}
        {snapshot.status === 'error' && snapshot.catalog === null && (
          <div className="dps-error" role="alert">
            <div>
              <strong>{t('store.loadFailed')}</strong>
              <p className="dps-status">{snapshot.error}</p>
            </div>
            <button className="dps-retry" type="button" onClick={refresh}>{t('store.retry')}</button>
          </div>
        )}
        {snapshot.catalog !== null && filtered.length === 0 && (
          <div className="dps-empty">{t('store.empty')}</div>
        )}
        {visible.length > 0 && (
          <>
            <div className="dps-grid">
              {visible.map((repository) => (
                <ProjectCard
                  key={repository.repositoryId}
                  repository={repository}
                  copied={copiedId === repository.repositoryId}
                  installed={installedIds.has(repository.repositoryId)}
                  onCopy={copyInstall}
                  onInstall={setInstallTarget}
                  t={t}
                />
              ))}
            </div>
            {visible.length < filtered.length && (
              <button
                className="dps-load-more"
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                {t('store.loadMore')}
              </button>
            )}
          </>
        )}
      </div>
      </section>
      <InstallRiskModal
        target={installTarget}
        onClose={closeInstallTarget}
        onInstalled={(repositoryId) => setInstalledIds((current) => new Set(current).add(repositoryId))}
        sessions={sessions}
        workspaces={workspaces}
        t={t}
      />
    </>
  )
}

export function StoreModal({ catalogStore, dialogController, open, installRequest, sessions, workspaces, t }) {
  return (
    <Modal
      open={open}
      onClose={() => dialogController.close()}
      title={t('header.title')}
      closeLabel={t('dialog.close')}
      className="dps-modal"
      headless
    >
      <div className="dps-modal-shell">
        <header className="dps-modal-header">
          <h2>{t('header.title')}</h2>
          <button
            className="dps-icon-button"
            type="button"
            onClick={() => dialogController.close()}
            aria-label={t('dialog.close')}
            title={t('dialog.close')}
          >
            <IconCloseOutline16 size={16} />
          </button>
        </header>
        <StoreView
          catalogStore={catalogStore}
          mode="dialog"
          requestedInstallTarget={installRequest}
          onInstallRequestConsumed={dialogController.consumeInstallRequest}
          sessions={sessions}
          workspaces={workspaces}
          t={t}
        />
      </div>
    </Modal>
  )
}

export function StoreOverlay({ dialogController, catalogStore, sessions, workspaces, t }) {
  const dialog = React.useSyncExternalStore(
    dialogController.subscribe,
    dialogController.getSnapshot,
  )

  return (
    <StoreModal
      catalogStore={catalogStore}
      dialogController={dialogController}
      open={dialog.open}
      installRequest={dialog.installRequest}
      sessions={sessions}
      workspaces={workspaces}
      t={t}
    />
  )
}

export function StoreHeaderAction({ dialogController, t }) {
  return (
    <button
      className="dps-header-button"
      type="button"
      onClick={() => dialogController.open()}
      aria-label={t('header.open')}
      title={t('header.open')}
    >
      <IconCordisPluginOutline14 size={16} />
    </button>
  )
}

export function StoreSettingsTab({ catalogStore, sessions, workspaces, t }) {
  return <StoreView catalogStore={catalogStore} mode="settings" sessions={sessions} workspaces={workspaces} t={t} />
}

import * as React from 'react'
import {
  Button,
  IconCheckOutline16,
  IconCloseOutline16,
  IconCopyOutline16,
  IconCordisPluginOutline14,
  IconDownloadOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
  IconWarningOutline16,
  Modal,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CATEGORY_LABELS,
  PROJECT_TYPE_LABELS,
  buildCatalogDetailUrl,
  buildInstallCommand,
  buildInstallPlan,
  filterCatalogRepositories,
  formatCompactNumber,
  getCatalogFilterOptions,
  mergeInstalledPlugins,
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

function ProjectCard({ repository, detailUrl, copied, onCopy, onInstall, onRemove, t }) {
  const command = buildInstallCommand(repository)
  const plan = buildInstallPlan(repository)
  const installed = repository.installed === true
  const updateAvailable = repository.updateAvailable === true
  const validationState = repository.validation?.overall
    ?? (repository.verified ? 'recorded' : 'check-pending')
  const validationLabel = repository.validation?.label ?? t(`store.validation.${validationState}`)
  const validationReason = repository.validation?.reason

  return (
    <article className="dps-card">
      {detailUrl !== null && (
        <a
          className="dps-card-link"
          href={detailUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t('store.openDetails')}: ${repository.fullName}`}
          title={t('store.openDetails')}
        />
      )}
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
          {validationLabel}
        </span>
        {installed && (
          <span className="dps-badge" data-kind={updateAvailable ? 'update' : 'installed'}>
            {updateAvailable ? t('store.updateAvailable') : t('store.installed')}
          </span>
        )}
        <span className="dps-badge">{CATEGORY_LABELS[repository.category] ?? repository.category}</span>
        <span className="dps-badge">{PROJECT_TYPE_LABELS[repository.projectType] ?? repository.projectType}</span>
      </div>
      <div className="dps-card-foot">
        <div className="dps-install-reference">
          <IconCordisPluginOutline14 size={14} />
          <code title={command ?? t('store.topicListed')}>{command ?? t('store.topicListed')}</code>
        </div>
        {(command !== null || installed) && (
          <div className="dps-card-actions">
            {plan !== null && (
              <Button
                className="dps-install-button"
                size="sm"
                variant="outline"
                type="button"
                disabled={installed && !updateAvailable}
                onClick={() => onInstall(repository)}
              >
                {updateAvailable
                  ? <IconRefreshOutline16 size={14} />
                  : installed
                    ? <IconCheckOutline16 size={14} />
                    : <IconDownloadOutline16 size={14} />}
                <span>{updateAvailable ? t('store.update') : installed ? t('store.installed') : t('store.install')}</span>
              </Button>
            )}
            {installed && (
              <button
                className="dps-icon-button dps-remove-button"
                type="button"
                onClick={() => onRemove(repository)}
                aria-label={t('store.remove')}
                title={t('store.remove')}
              >
                <IconTrashOutline16 size={16} />
              </button>
            )}
            {command !== null && <button
              className="dps-icon-button"
              type="button"
              onClick={() => onCopy(repository.repositoryId, command)}
              aria-label={copied ? t('store.copied') : t('store.copyInstall')}
              title={copied ? t('store.copied') : t('store.copyInstall')}
            >
              {copied ? <IconCheckOutline16 size={16} /> : <IconCopyOutline16 size={16} />}
            </button>}
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
  const updating = target?.updateAvailable === true
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
      title={t(updating ? 'store.updateRiskTitle' : 'store.riskTitle')}
      closeLabel={t('store.cancel')}
      className="dps-risk-modal"
      headless
    >
      {target !== null && (
        <div className="dps-risk-shell">
          <header className="dps-risk-header">
            <div className="dps-risk-title">
              <IconWarningOutline16 size={18} />
              <h2>{t(updating ? 'store.updateRiskTitle' : 'store.riskTitle')}</h2>
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
            <strong>{t(updating ? 'store.updateRiskLead' : 'store.riskLead')}</strong>
            <p>{t(updating ? 'store.updateRiskDetail' : 'store.riskDetail')}</p>
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
            {phase === 'installing' && <p className="dps-install-status" role="status">{t(updating ? 'store.updating' : 'store.installing')}</p>}
            {phase === 'success' && <p className="dps-install-status" data-kind="success" role="status">{t(updating ? 'store.updateSuccess' : 'store.installSuccess')}</p>}
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
                  {phase === 'installing' ? t(updating ? 'store.updating' : 'store.installing') : t(updating ? 'store.confirmUpdate' : 'store.confirmInstall')}
                </Button>
              </>
            )}
          </footer>
        </div>
      )}
    </Modal>
  )
}

function RemovePluginModal({ target, onClose, onRemoved, t }) {
  const [phase, setPhase] = React.useState('idle')
  const [message, setMessage] = React.useState('')
  const finished = phase === 'success'

  React.useEffect(() => {
    setPhase('idle')
    setMessage('')
  }, [target?.repositoryId])

  const close = () => {
    if (phase !== 'removing') onClose()
  }

  const remove = async () => {
    if (target === null || phase === 'removing' || target.installedPlugin?.name === undefined) return
    setPhase('removing')
    setMessage('')
    try {
      const response = await fetch('/api/dsh-plugin-store/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: target.installedPlugin.name }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true) {
        throw new Error(body.message ?? `${t('store.removeFailed')} (${response.status})`)
      }
      setPhase('success')
      setMessage(body.output ?? '')
      onRemoved(target.installedPlugin.name)
    } catch (error) {
      setPhase('error')
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={close}
      title={t('store.removeTitle')}
      closeLabel={t('store.cancel')}
      className="dps-risk-modal"
      headless
    >
      {target !== null && (
        <div className="dps-risk-shell">
          <header className="dps-risk-header">
            <div className="dps-risk-title dps-remove-title">
              <IconTrashOutline16 size={18} />
              <h2>{t('store.removeTitle')}</h2>
            </div>
            <button className="dps-icon-button" type="button" onClick={close} disabled={phase === 'removing'} aria-label={t('store.cancel')} title={t('store.cancel')}>
              <IconCloseOutline16 size={16} />
            </button>
          </header>
          <div className="dps-risk-body">
            <strong>{t('store.removeLead')}</strong>
            <p>{t('store.removeDetail')}</p>
            <div className="dps-risk-repository">
              <span>{target.fullName}</span>
              <code>{target.installedPlugin.name}</code>
            </div>
            {phase === 'removing' && <p className="dps-install-status" role="status">{t('store.removing')}</p>}
            {phase === 'success' && <p className="dps-install-status" data-kind="success" role="status">{t('store.removeSuccess')}</p>}
            {phase === 'error' && <p className="dps-install-status" data-kind="error" role="alert"><strong>{t('store.removeFailed')}</strong><span>{message}</span></p>}
            {phase === 'success' && message && <pre className="dps-install-output">{message}</pre>}
          </div>
          <footer className="dps-risk-actions">
            {finished ? (
              <Button size="sm" variant="outline" type="button" onClick={close}>{t('store.done')}</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" type="button" disabled={phase === 'removing'} onClick={close}>{t('store.cancel')}</Button>
                <Button size="sm" variant="primary" type="button" disabled={phase === 'removing'} onClick={remove}>{phase === 'removing' ? t('store.removing') : t('store.confirmRemove')}</Button>
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
  const [sort, setSort] = React.useState('recommended')
  const [verifiedOnly, setVerifiedOnly] = React.useState(false)
  const [installedOnly, setInstalledOnly] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [copiedId, setCopiedId] = React.useState(null)
  const [installTarget, setInstallTarget] = React.useState(null)
  const [installedState, setInstalledState] = React.useState({ status: 'loading', plugins: [] })
  const [removeTarget, setRemoveTarget] = React.useState(null)

  React.useEffect(() => {
    catalogStore.load()
  }, [catalogStore])

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, category, sort, verifiedOnly, installedOnly])

  const refreshInstalled = async () => {
    setInstalledState((current) => ({ ...current, status: 'loading' }))
    try {
      const response = await fetch('/api/dsh-plugin-store/plugins', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || !Array.isArray(body.plugins)) {
        throw new Error(body.message ?? `${t('store.installedLoadFailed')} (${response.status})`)
      }
      setInstalledState({ status: 'ready', plugins: body.plugins })
    } catch (error) {
      setInstalledState({ status: 'error', plugins: [] })
    }
  }

  React.useEffect(() => {
    void refreshInstalled()
  }, [])

  const repositories = React.useMemo(
    () => mergeInstalledPlugins(snapshot.catalog?.repositories ?? [], installedState.plugins),
    [snapshot.catalog, installedState.plugins],
  )
  const filterOptions = React.useMemo(
    () => getCatalogFilterOptions(snapshot.catalog),
    [snapshot.catalog],
  )

  React.useEffect(() => {
    if (!filterOptions.categories.includes(category)) setCategory('all')
  }, [category, filterOptions])
  React.useEffect(() => {
    const target = buildExternalInstallTarget(requestedInstallTarget, repositories)
    if (target !== null) setInstallTarget(target)
  }, [requestedInstallTarget, repositories])

  const filtered = React.useMemo(() => filterCatalogRepositories(repositories, {
    query,
    category,
    sort,
    verifiedOnly,
    installedOnly,
  }), [repositories, query, category, sort, verifiedOnly, installedOnly])
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

  const refresh = () => {
    void refreshInstalled()
    return catalogStore.load({ force: true })
  }
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
          {installedState.status === 'error' && <p role="status">{t('store.installedLoadFailed')}</p>}
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
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label={t('store.category')}
          >
            {filterOptions.categories.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? t('store.categoryAll') : CATEGORY_LABELS[value] ?? value}
              </option>
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
        <label className="dps-check">
          <input
            type="checkbox"
            checked={installedOnly}
            onChange={(event) => setInstalledOnly(event.target.checked)}
          />
          <span>{t('store.installedOnly')}</span>
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
        {snapshot.status === 'error' && snapshot.catalog !== null && (
          <div className="dps-stale" role="status">
            <span>{t('store.refreshFailed')}: {snapshot.error}</span>
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
                  detailUrl={buildCatalogDetailUrl(catalogStore.url, repository.repositoryId)}
                  copied={copiedId === repository.repositoryId}
                  onCopy={copyInstall}
                  onInstall={setInstallTarget}
                  onRemove={(target) => setRemoveTarget(target)}
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
        onInstalled={() => { void refreshInstalled() }}
        sessions={sessions}
        workspaces={workspaces}
        t={t}
      />
      <RemovePluginModal
        target={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onRemoved={() => { void refreshInstalled() }}
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

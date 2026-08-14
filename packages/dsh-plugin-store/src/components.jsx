import * as React from 'react'
import {
  IconCheckOutline16,
  IconCloseOutline16,
  IconCopyOutline16,
  IconCordisPluginOutline14,
  IconRefreshOutline16,
  IconRightUpOutline16,
  Modal,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CATEGORY_LABELS,
  PROJECT_TYPE_LABELS,
  buildInstallCommand,
  filterCatalogRepositories,
  formatCompactNumber,
} from './catalog.js'

const PAGE_SIZE = 24

function ProjectCard({ repository, copied, onCopy, t }) {
  const command = buildInstallCommand(repository)
  const detailUrl = `https://dsh.aitreez.com/plugins/${repository.repositoryId}`

  return (
    <article className="dps-card">
      <div className="dps-card-head">
        <div className="dps-card-title">
          <h3 title={repository.name}>{repository.name}</h3>
        </div>
        <span className="dps-stars">{t('store.stars', { count: formatCompactNumber(repository.stars) })}</span>
      </div>
      <p className="dps-card-repo" title={repository.fullName}>{repository.fullName}</p>
      <p className="dps-card-description">{repository.description}</p>
      <div className="dps-badges">
        {repository.verified && <span className="dps-badge" data-kind="verified">{t('store.verified')}</span>}
        {repository.awesomeListed && <span className="dps-badge" data-kind="awesome">{t('store.awesome')}</span>}
        <span className="dps-badge">{CATEGORY_LABELS[repository.category] ?? CATEGORY_LABELS.other}</span>
        <span className="dps-badge">{PROJECT_TYPE_LABELS[repository.projectType] ?? repository.projectType}</span>
      </div>
      <div className="dps-card-foot">
        <div className="dps-install-reference">
          <IconCordisPluginOutline14 size={14} />
          <code title={command ?? t('store.topicListed')}>{command ?? t('store.topicListed')}</code>
        </div>
        <div className="dps-card-actions">
          {command !== null && (
            <button
              className="dps-icon-button"
              type="button"
              onClick={() => onCopy(repository.repositoryId, command)}
              aria-label={copied ? t('store.copied') : t('store.copyInstall')}
              title={copied ? t('store.copied') : t('store.copyInstall')}
            >
              {copied ? <IconCheckOutline16 size={16} /> : <IconCopyOutline16 size={16} />}
            </button>
          )}
          <a
            className="dps-icon-button"
            href={detailUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t('store.openDetails')}
            title={t('store.openDetails')}
          >
            <IconCordisPluginOutline14 size={14} />
          </a>
          <a
            className="dps-icon-button"
            href={repository.url}
            target="_blank"
            rel="noreferrer"
            aria-label={t('store.openRepository')}
            title={t('store.openRepository')}
          >
            <IconRightUpOutline16 size={16} />
          </a>
        </div>
      </div>
    </article>
  )
}

export function StoreView({ catalogStore, mode, t }) {
  const snapshot = React.useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getSnapshot,
  )
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [sort, setSort] = React.useState('recommended')
  const [verifiedOnly, setVerifiedOnly] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [copiedId, setCopiedId] = React.useState(null)

  React.useEffect(() => {
    catalogStore.load()
  }, [catalogStore])

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, category, sort, verifiedOnly])

  const repositories = snapshot.catalog?.repositories ?? []
  const filtered = React.useMemo(() => filterCatalogRepositories(repositories, {
    query,
    category,
    sort,
    verifiedOnly,
  }), [repositories, query, category, sort, verifiedOnly])
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

  return (
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
                  onCopy={copyInstall}
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
  )
}

export function StoreModal({ catalogStore, dialogController, open, sessionId, t }) {
  return (
    <Modal
      open={open}
      onClose={() => dialogController.close(sessionId)}
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
            onClick={() => dialogController.close(sessionId)}
            aria-label={t('dialog.close')}
            title={t('dialog.close')}
          >
            <IconCloseOutline16 size={16} />
          </button>
        </header>
        <StoreView catalogStore={catalogStore} mode="dialog" t={t} />
      </div>
    </Modal>
  )
}

export function StoreHeaderAction({ sessionId, dialogController, catalogStore, t }) {
  const dialog = React.useSyncExternalStore(
    dialogController.subscribe,
    dialogController.getSnapshot,
  )
  const open = dialog.bySession[String(sessionId)] ?? false

  return (
    <>
      <button
        className="dps-header-button"
        type="button"
        onClick={() => dialogController.open(sessionId)}
        aria-label={t('header.open')}
        title={t('header.open')}
      >
        <IconCordisPluginOutline14 size={16} />
      </button>
      <StoreModal
        catalogStore={catalogStore}
        dialogController={dialogController}
        open={open}
        sessionId={sessionId}
        t={t}
      />
    </>
  )
}

export function StoreSettingsTab({ catalogStore, t }) {
  return <StoreView catalogStore={catalogStore} mode="settings" t={t} />
}

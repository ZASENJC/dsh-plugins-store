export const styles = String.raw`
.dps-header-button,
.dps-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 0;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
}

.dps-header-button {
  width: 30px;
  height: 30px;
  border-radius: 6px;
}

.dps-header-button:hover,
.dps-icon-button:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dps-header-button:focus-visible,
.dps-icon-button:focus-visible,
.dps-load-more:focus-visible,
.dps-retry:focus-visible,
.dps-filter input:focus-visible,
.dps-filter select:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l3);
  outline-offset: 1px;
}

.dps-modal {
  width: min(1040px, calc(100vw - 32px));
  max-width: none;
  height: min(760px, calc(100vh - 32px));
  padding: 0;
  overflow: hidden;
}

.dps-modal-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary);
}

.dps-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 0 18px 0 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.dps-modal-header h2 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0;
}

.dps-store {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 18px 22px 22px;
  color: var(--dsw-alias-label-primary);
}

.dps-store[data-mode='settings'] {
  min-height: min(680px, calc(100vh - 160px));
  padding: 4px 0 20px;
}

.dps-store-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dps-store-meta {
  min-width: 0;
}

.dps-store-meta p,
.dps-disclaimer,
.dps-status,
.dps-result-count {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
}

.dps-store-meta p:first-child {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}

.dps-icon-button {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.dps-filter-bar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 150px 140px auto;
  gap: 8px;
  align-items: center;
}

.dps-filter {
  min-width: 0;
}

.dps-filter input,
.dps-filter select {
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  padding: 0 10px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
  font-size: 13px;
  letter-spacing: 0;
}

.dps-check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.dps-check input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #4f9f75;
}

.dps-catalog-scroll {
  min-width: 0;
  min-height: 0;
  padding-right: 4px;
  overflow-y: auto;
}

.dps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dps-card {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 174px;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
}

.dps-card-head,
.dps-card-foot,
.dps-card-title,
.dps-badges,
.dps-card-actions,
.dps-install-reference {
  display: flex;
  align-items: center;
}

.dps-card-head,
.dps-card-foot {
  justify-content: space-between;
  gap: 10px;
}

.dps-card-title {
  min-width: 0;
  gap: 8px;
}

.dps-card-title h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-repo {
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dps-badges {
  flex-wrap: wrap;
  gap: 5px;
}

.dps-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  box-sizing: border-box;
  border-radius: 999px;
  padding: 1px 7px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}

.dps-badge[data-kind='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='awesome'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
}

.dps-stars {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.dps-install-reference {
  min-width: 0;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
}

.dps-install-reference code {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-actions {
  flex: 0 0 auto;
  gap: 2px;
}

.dps-card-actions a {
  text-decoration: none;
}

.dps-empty,
.dps-error,
.dps-loading {
  display: grid;
  place-items: center;
  min-height: 240px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}

.dps-error {
  gap: 10px;
}

.dps-retry,
.dps-load-more {
  min-height: 32px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  padding: 0 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dps-load-more {
  display: block;
  margin: 12px auto 2px;
}

@media (max-width: 760px) {
  .dps-modal {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
  }

  .dps-store {
    padding: 14px 12px 16px;
  }

  .dps-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .dps-filter-search {
    grid-column: 1 / -1;
  }

  .dps-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dps-header-button,
  .dps-icon-button,
  .dps-retry,
  .dps-load-more {
    transition: none;
  }
}
`

export function installStyles() {
  const id = 'dsh-plugin-store-styles'
  const existing = document.getElementById(id)
  if (existing !== null) return () => {}
  const element = document.createElement('style')
  element.id = id
  element.textContent = styles
  document.head.append(element)
  return () => element.remove()
}

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
.dps-install-button:focus-visible,
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

.dps-store[data-mode='settings'] .dps-filter-bar {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
}

.dps-store[data-mode='settings'] .dps-filter-search {
  grid-column: 1 / -1;
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
  grid-template-columns: minmax(220px, 1fr) 140px 160px 140px auto;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dps-card {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
}

.dps-card-link {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}

.dps-card-link:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l3);
  outline-offset: -2px;
}

.dps-card:has(.dps-card-link:hover),
.dps-card:has(.dps-card-link:focus-visible) {
  border-color: var(--dsw-alias-border-l3);
  background: var(--dsw-alias-interactive-bg-hover);
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
  min-width: 0;
  justify-content: space-between;
  gap: 10px;
}

.dps-card-head {
  flex: 1 1 240px;
}

.dps-card-title {
  flex: 1 1 auto;
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
  flex: 0 1 180px;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-description {
  flex: 2 1 260px;
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dps-badges {
  flex: 2 1 240px;
  flex-wrap: wrap;
  gap: 5px;
}

.dps-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  border-radius: 999px;
  padding: 1px 7px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-interactive-bg-hover);
  font-size: 10px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-badge[data-kind='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='verified'] {
  color: #5eb98a;
  background: color-mix(in srgb, #4f9f75 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status$='failed'] {
  color: #df6d6d;
  background: color-mix(in srgb, #df6d6d 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status$='running'] {
  color: #6ba8d6;
  background: color-mix(in srgb, #6ba8d6 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='expired'],
.dps-badge[data-kind='validation'][data-status='inconclusive'],
.dps-badge[data-kind='validation'][data-status='sandbox-pending'],
.dps-badge[data-kind='validation'][data-status='security-review'] {
  color: #d89450;
  background: color-mix(in srgb, #d89450 14%, transparent);
}

.dps-badge[data-kind='validation'][data-status='recorded'] {
  color: #8d8bce;
  background: color-mix(in srgb, #8d8bce 14%, transparent);
}

.dps-stars {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.dps-install-reference {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
}

.dps-install-reference > svg {
  flex: 0 0 auto;
}

.dps-install-reference code {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-card-actions {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  min-width: 0;
  gap: 2px;
}

.dps-card-foot {
  flex: 1 1 100%;
}

.dps-validation-reason {
  flex: 1 1 100%;
  min-width: 0;
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.dps-install-button {
  display: inline-flex;
  min-width: 0;
  height: 28px;
  gap: 4px;
  padding: 0 8px;
  white-space: nowrap;
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

body > :has(> .dps-risk-modal) {
  z-index: 1001;
}

.dps-risk-modal {
  width: min(520px, calc(100vw - 32px));
  max-width: none;
  padding: 0;
  overflow: hidden;
}

.dps-risk-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
}

.dps-risk-header,
.dps-risk-actions,
.dps-risk-title {
  display: flex;
  align-items: center;
}

.dps-risk-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 54px;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.dps-risk-title {
  min-width: 0;
  gap: 8px;
  color: var(--dsw-alias-state-warning-primary, #d89450);
}

.dps-risk-title h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  line-height: 22px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dps-risk-body {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 18px;
}

.dps-risk-body > strong,
.dps-risk-body > p {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 20px;
}

.dps-risk-body > p {
  color: var(--dsw-alias-label-secondary);
}

.dps-risk-repository {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
}

.dps-risk-repository span,
.dps-risk-repository code,
.dps-install-output {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.dps-risk-repository span {
  font-size: 13px;
  font-weight: 600;
}

.dps-risk-version {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.dps-risk-version select {
  min-width: 0;
  max-width: 100%;
  height: 28px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  padding: 0 7px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font: inherit;
}

.dps-risk-repository code,
.dps-install-output {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 17px;
}

.dps-risk-acknowledge {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.dps-risk-acknowledge input {
  width: 15px;
  height: 15px;
  margin: 2px 0 0;
  accent-color: #4f9f75;
}

.dps-install-status {
  display: grid;
  gap: 3px;
}

.dps-install-status[data-kind='success'] {
  color: var(--dsw-alias-state-success-primary, #5eb98a);
}

.dps-install-status[data-kind='error'] {
  color: var(--dsw-alias-state-error-primary, #df6d6d);
}

.dps-install-analysis {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.dps-install-output {
  max-height: 120px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
}

.dps-risk-actions {
  justify-content: flex-end;
  gap: 8px;
  min-height: 58px;
  padding: 0 18px;
  border-top: 1px solid var(--dsw-alias-border-l1);
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

  .dps-risk-modal {
    width: calc(100vw - 16px);
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

  .dps-store[data-mode='settings'] .dps-filter-bar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .dps-store[data-mode='settings'] .dps-check {
    grid-column: 1 / -1;
  }

  .dps-card-repo,
  .dps-card-description,
  .dps-badges,
  .dps-card-head { flex-basis: 100%; }

  .dps-risk-version { grid-template-columns: 1fr; gap: 4px; }
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

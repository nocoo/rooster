import { pendingApproval, respondApproval } from '../state/chat.js'

export function ApprovalDialog() {
  const approval = pendingApproval.value
  if (!approval) return null

  return (
    <div class="approval-dialog Box color-shadow-medium">
      <div class="Box-header">
        <h3 class="Box-title f5">Permission Required</h3>
      </div>
      <div class="Box-body">
        <div class="approval-command">
          <code class="f6">{approval.command}</code>
        </div>
        {approval.description && (
          <p class="approval-description color-fg-muted f6 mt-2">{approval.description}</p>
        )}
        <div class="approval-actions mt-3">
          {approval.choices.map((choice) => (
            <button
              key={choice}
              class={`btn btn-sm mr-2 ${choice === 'allow' ? 'btn-primary' : 'btn-danger'}`}
              disabled={approval.responding}
              onClick={() => { respondApproval(choice) }}
            >
              {approval.responding ? '…' : choice}
            </button>
          ))}
        </div>
        {approval.allow_permanent && (
          <p class="f6 color-fg-muted mt-2">This can be allowed permanently.</p>
        )}
      </div>
    </div>
  )
}

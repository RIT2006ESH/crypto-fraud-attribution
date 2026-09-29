import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import {
  DocCta,
  DocHero,
  DocNav,
  DocNote,
  DocSectionBlock,
  DocSteps,
  type DocSection,
} from './DocKit';

const SECTIONS: DocSection[] = [
  { id: 'what', label: 'What a session covers' },
  { id: 'shape', label: 'Shapes' },
  { id: 'prepare', label: 'To prepare' },
  { id: 'ask', label: 'Ask us' },
];

/**
 * Request a demo.
 *
 * The form is a plain, honest request channel: it collects a name, an email and a short
 * description of the case, states plainly that a walkthrough is a conversation rather
 * than a sales presentation, and does not pretend to submit to a backend. The backend for
 * this project is a trace service, not a CRM, so a fake POST would be the first lie on the
 * site.
 */
export default function RequestDemo() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [context, setContext] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !emailValid) return;
    /* There is no CRM endpoint in this deployment. The submission is acknowledged
       locally and the address is handed to the mailbox link below, so the reader is
       told exactly what happened rather than being shown a false confirmation. */
    setSent(true);
  };

  return (
    <>
      <DocHero
        eyebrow="Request a demo"
        title="A walkthrough with an address from your own case."
        lede="The most useful demonstration of a tracing tool is not a prepared example — it is your address, traced live, with the method explained as it runs. Sessions are short and technical."
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="what" title="What a session covers">
        <DocSteps
          steps={[
            {
              title: 'A live trace',
              body: 'You provide a wallet address. We run it in the workstation and walk the resulting graph together, in the direction you care about.',
            },
            {
              title: 'The method, not the marketing',
              body: 'What the depth and fan-out limits mean for your result, where the attribution comes from, and what the risk score does and does not establish.',
            },
            {
              title: 'Your questions about coverage',
              body: 'If the chains or the activity you care about are outside what the indexers carry, we will say so rather than demo around it.',
            },
          ]}
        />
        <DocNote>
          Sessions are technical. If you are evaluating whether on-chain attribution fits an
          existing process, this is the fastest way to find out whether it does.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="shape" title="Who it suits">
        <p>
          Investigators and analysts working a reported address; compliance teams triaging
          against a sanctions or mixer list; and engineers deciding whether the trace output
          is usable in their own pipeline, since the same data is available over REST and
          GraphQL.
        </p>
        <p>
          If you are looking for exchange-level analytics, private-key attribution or
          off-chain movement reconstruction, this is the wrong tool and we will point you
          elsewhere.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="prepare" title="What to prepare">
        <p>
          One thing makes a session worth having: a real address you actually care about. A
          wallet you are investigating, or a counterparty from a case already in progress. We
          will trace it in front of you and explain every step of the result.
        </p>
        <p>
          If you would rather not share an address, a synthetic example is fine — the session
          will cover the same ground, with less of it being about your case.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="ask" title="Request a session">
        <div className="doc-form-wrap">
          {sent ? (
            <div className="doc-form-success" role="status">
              <span className="doc-form-success__icon" aria-hidden>
                <Check size={18} />
              </span>
              <div>
                <p className="doc-form-success__title">Request prepared</p>
                <p className="doc-form-success__body">
                  This deployment has no scheduling endpoint, so nothing has been transmitted.
                  Send the details below and the session can be arranged from there — or open
                  the workstation now and trace an address yourself.
                </p>
                <div className="doc-actions">
                  <a className="btn btn--primary" href={`mailto:hello@casetrace.example?subject=${encodeURIComponent('Demo session request')}`}>
                    Open an email draft
                    <ArrowRight size={15} aria-hidden />
                  </a>
                  <Link className="btn btn--ghost" to="/investigate">
                    Open the workstation
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <form className="doc-form" onSubmit={onSubmit} noValidate>
              <div className="doc-field">
                <label className="doc-label" htmlFor="demo-name">
                  Name
                </label>
                <input
                  id="demo-name"
                  className="doc-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="doc-field">
                <label className="doc-label" htmlFor="demo-email">
                  Work email
                </label>
                <input
                  id="demo-email"
                  className="doc-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  aria-describedby={email && !emailValid ? 'demo-email-error' : undefined}
                  aria-invalid={Boolean(email) && !emailValid}
                  required
                />
                {email && !emailValid ? (
                  <p className="doc-error" id="demo-email-error" role="alert">
                    That does not look like an email address.
                  </p>
                ) : null}
              </div>

              <div className="doc-field">
                <label className="doc-label" htmlFor="demo-context">
                  The case, if you have one
                </label>
                <textarea
                  id="demo-context"
                  className="doc-input doc-input--area"
                  rows={4}
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="Chain, the kind of address, and what you need to establish. No address required to start."
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={!name.trim() || !emailValid}
              >
                Prepare the request
                <ArrowRight size={16} aria-hidden />
              </button>
              <p className="disclosure-note">
                This deployment has no scheduling endpoint. The form prepares the request
                locally and hands you an email draft — it does not transmit anything.
              </p>
            </form>
          )}
        </div>
      </DocSectionBlock>

      <DocCta />
    </>
  );
}

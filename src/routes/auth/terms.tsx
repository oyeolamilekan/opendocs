import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "../../components/brand";
import { Card } from "../../components/ui/card";
import { ThemeToggle } from "../../components/theme-toggle";
import { seoMeta } from "../../lib/seo";

export const Route = createFileRoute("/auth/terms")({
  head: () => ({
    meta: seoMeta({
      title: "Terms of Service",
      description: "Terms governing use of the openapidoc hosted service.",
      path: "/auth/terms",
      noindex: true,
    }),
  }),
  component: Terms,
});

const headingClass = "text-lg font-semibold tracking-tight text-foreground";
const listClass = "list-disc space-y-2 pl-5";

function Terms() {
  return (
    <main className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <Card className="mt-8 p-7 sm:p-10">
          <Link
            to="/auth/sign-up"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to signup
          </Link>

          <header className="mt-8 border-b pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Legal
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated July 13, 2026
            </p>
          </header>

          <div className="mt-8 space-y-9 text-sm leading-7 text-muted-foreground">
            <section className="space-y-3">
              <h2 className={headingClass}>1. Agreement to these Terms</h2>
              <p>
                These Terms of Service (the “Terms”) are an agreement between
                you and Oye Olalekan Johnson, the operator of openapidoc (“we,”
                “us,” or “our”). They govern your access to and use of the
                hosted openapidoc website, workspaces, APIs, publishing tools,
                AI features, and related services (together, the “Service”).
              </p>
              <p>
                By creating an account, accepting these Terms, or using the
                Service, you agree to be bound by them. If you use the Service
                for an organization, you confirm that you have authority to
                accept these Terms for that organization. If you do not agree,
                do not use the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>2. The Service</h2>
              <p>
                openapidoc helps teams create, import, organize, test, publish,
                and analyze API documentation. The Service may include public
                documentation sites, OpenAPI imports and exports, versioning,
                team workspaces, analytics, AI-assisted authoring, endpoint
                testing, agent-oriented exports, and integrations.
              </p>
              <p>
                We may improve, add, remove, or change features over time. We
                will use reasonable efforts to avoid materially reducing a
                paid feature during its current subscription period, except
                where a change is needed for security, legal compliance, or to
                address third-party platform changes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>3. Accounts and eligibility</h2>
              <p>
                You must be at least 18 years old and legally able to enter
                into this agreement. Account information must be accurate and
                kept up to date. You are responsible for safeguarding your
                login details and for activity performed through your account.
                Tell us promptly if you suspect unauthorized access.
              </p>
              <p>
                Workspace owners and administrators are responsible for member
                invitations, permissions, and activity within their
                organization. You may not share an account in a way that
                bypasses plan limits or misrepresents who is using it.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>4. Plans, fees, and taxes</h2>
              <p>
                The Service may offer free and paid plans. If you choose a paid
                plan, you authorize us and our payment provider to charge the
                price, applicable taxes, and usage-based amounts shown when you
                subscribe. Unless the order states otherwise, subscriptions
                renew automatically for the same billing period until
                cancelled.
              </p>
              <p>
                Fees are non-refundable except where required by law or
                expressly stated at purchase. We may change future pricing by
                giving reasonable advance notice. We may restrict or suspend
                paid features when an amount remains overdue.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>5. Acceptable use</h2>
              <p>You must not use the Service to:</p>
              <ul className={listClass}>
                <li>break any law or another person’s legal rights;</li>
                <li>
                  publish content you do not have the right to use or disclose;
                </li>
                <li>
                  upload malware, probe for vulnerabilities, disrupt the
                  Service, or evade security or usage limits;
                </li>
                <li>
                  access an API, system, or account without authorization;
                </li>
                <li>
                  send spam, facilitate fraud, impersonate another person, or
                  distribute deceptive or harmful material;
                </li>
                <li>
                  resell or provide the hosted Service as a standalone product
                  without our written permission; or
                </li>
                <li>
                  reverse engineer the hosted Service except to the limited
                  extent that applicable law expressly permits it.
                </li>
              </ul>
              <p>
                We may investigate suspected misuse and may remove content,
                limit traffic, or suspend access when reasonably necessary to
                protect users, the Service, or third parties.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>6. Your content and credentials</h2>
              <p>
                You retain ownership of API specifications, documentation,
                files, branding, request examples, and other material you or
                your users submit to the Service (“Customer Content”). You
                grant us a non-exclusive, worldwide, royalty-free license to
                host, copy, process, transmit, display, and back up Customer
                Content only as needed to operate, secure, support, and improve
                the Service and to comply with law.
              </p>
              <p>
                You are responsible for Customer Content and for having all
                permissions, notices, and consents needed for us to process it.
                Do not place secrets in public documentation. When you publish
                a project, you direct us to make the selected content and
                exports publicly available.
              </p>
              <p>
                If you provide API keys or credentials for AI providers or
                endpoint testing, you authorize us to use and transmit them as
                needed to perform the request you initiate. You must have
                permission to use every credential and target endpoint. You
                remain responsible for provider charges, API activity, and the
                security settings of the systems you connect.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>7. Privacy and service data</h2>
              <p>
                We process account, workspace, usage, and technical data to
                provide, secure, maintain, and improve the Service. You are
                responsible for ensuring that personal data included in
                Customer Content is collected and shared lawfully, including
                giving any notices and obtaining any consents required from
                your users.
              </p>
              <p>
                We may create aggregated or de-identified statistics that do
                not identify you or any individual and use them to operate,
                understand, and improve the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>8. Our technology and feedback</h2>
              <p>
                We and our licensors retain all rights in the hosted Service,
                its design, branding, and technology, excluding Customer
                Content. These Terms give you a limited, non-exclusive,
                non-transferable right to use the Service while your account is
                active and in accordance with your plan.
              </p>
              <p>
                Parts of openapidoc are available as open-source software.
                Your use, modification, and distribution of that software are
                governed by its applicable open-source license, not these
                Terms. If you send us feedback, you allow us to use it without
                restriction or payment to you.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>
                9. AI, previews, and generated output
              </h2>
              <p>
                AI-assisted and preview features may produce inaccurate,
                incomplete, insecure, or unsuitable output. You must review
                generated documentation and code before publishing or relying
                on it. Output may not be unique, and other users may receive
                similar results. Do not use AI output as a substitute for
                professional advice or independent security review.
              </p>
              <p>
                Features identified as alpha, beta, experimental, or preview
                may change or stop without notice and may be subject to lower
                availability or support commitments.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>10. Third-party services</h2>
              <p>
                The Service may connect to hosting providers, databases,
                analytics tools, payment processors, AI providers, and APIs
                controlled by others. Your use of a third-party service is
                governed by its own terms and privacy practices. We are not
                responsible for third-party services, their availability, or
                changes they make.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>11. Confidential information</h2>
              <p>
                Each party may receive non-public information that a reasonable
                person would understand to be confidential. The receiving
                party will use reasonable care to protect it and will use it
                only to perform or exercise rights under these Terms.
                Information is not confidential if it becomes public without a
                breach, was already lawfully known, is received lawfully from
                another source, or is independently developed.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>12. Suspension and termination</h2>
              <p>
                You may stop using the Service at any time. You may cancel a
                paid plan through the available account controls, with
                cancellation taking effect at the end of the current billing
                period unless applicable law requires otherwise.
              </p>
              <p>
                We may suspend or terminate access if you materially breach
                these Terms, create a security or legal risk, fail to pay an
                amount due, or use the Service in a way that could harm us,
                other users, or third parties. Where practical, we will give
                notice and an opportunity to correct the issue.
              </p>
              <p>
                After termination, your right to use the hosted Service ends.
                We may delete Customer Content after a reasonable export
                period, subject to legal obligations and routine backup
                retention. Sections that by their nature should continue will
                survive, including ownership, disclaimers, liability limits,
                indemnity, and dispute terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>13. Disclaimers</h2>
              <p className="font-medium text-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
                “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL IMPLIED WARRANTIES,
                INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
                PROMISE THAT THE SERVICE OR ANY GENERATED OUTPUT WILL BE
                UNINTERRUPTED, SECURE, ACCURATE, OR ERROR-FREE.
              </p>
              <p>
                These disclaimers do not limit any warranty or consumer right
                that cannot lawfully be excluded.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>14. Limitation of liability</h2>
              <p className="font-medium text-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE
                LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE,
                OR CONSEQUENTIAL LOSS, OR FOR LOST PROFITS, REVENUE, DATA,
                GOODWILL, OR BUSINESS OPPORTUNITY. OUR TOTAL LIABILITY ARISING
                FROM THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF
                THE AMOUNT YOU PAID US FOR THE SERVICE DURING THE 12 MONTHS
                BEFORE THE EVENT GIVING RISE TO THE CLAIM OR US$100.
              </p>
              <p>
                This section does not exclude liability that cannot be limited
                by law. The limits apply to the fullest extent permitted even
                if a remedy fails of its essential purpose.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>15. Indemnity</h2>
              <p>
                To the extent permitted by law, you will defend and indemnify
                us against third-party claims, losses, and reasonable costs
                arising from Customer Content, your connected systems or
                credentials, your violation of these Terms, or your violation
                of another person’s rights or applicable law. We will promptly
                notify you of a covered claim and reasonably cooperate with
                your defense.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>16. Changes to these Terms</h2>
              <p>
                We may update these Terms to reflect changes to the Service,
                law, or our business. If a change materially affects your
                rights, we will provide reasonable advance notice through the
                Service, by email, or by another appropriate method. The notice
                will state when the revised Terms take effect. Continuing to
                use the Service after that date means you accept the update.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>
                17. Governing law and disputes
              </h2>
              <p>
                These Terms are governed by the laws of the Federal Republic
                of Nigeria, without regard to conflict-of-law rules. The courts
                located in Lagos State, Nigeria will have exclusive
                jurisdiction over disputes arising from the Service or these
                Terms, except where applicable consumer law gives you the right
                to bring a claim elsewhere.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>18. General terms</h2>
              <p>
                These Terms and any order or plan terms are the entire
                agreement about the hosted Service and replace earlier
                agreements on that subject. You may not assign these Terms
                without our written consent. We may assign them as part of a
                reorganization, financing, merger, acquisition, or sale of the
                relevant business. If a provision is unenforceable, it will be
                adjusted only as much as needed and the remaining provisions
                will stay in effect. A failure to enforce a provision is not a
                waiver. Neither party is liable for delay caused by events
                beyond its reasonable control.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className={headingClass}>19. Contact</h2>
              <p>
                Questions or legal notices about these Terms may be sent to Oye
                Olalekan Johnson at{" "}
                <a
                  href="mailto:johnsonoye34@gmail.com"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  johnsonoye34@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}

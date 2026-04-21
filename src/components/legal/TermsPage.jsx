import './legal.css';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1 className="legal-title">Terms of Use</h1>
        <p className="legal-updated">Last updated: April 21, 2026</p>

        <div className="legal-intro">
          <strong>Please read carefully.</strong> By accessing or using FuelSaver (the &quot;Service&quot;),
          you agree to be bound by these Terms of Use. If you do not agree, please do not use the
          Service.
        </div>

        <section className="legal-section">
          <h2>1. The Service</h2>
          <p>
            FuelSaver is an independent service, accessible at{' '}
            <a href="https://fuelsaver.one">https://fuelsaver.one</a> and through our mobile apps,
            that aggregates publicly available fuel price data from official government sources and
            third-party databases. The Service lets you search for fuel prices, locate nearby
            stations, and estimate the fuel cost of a trip.
          </p>
          <p>
            The Service is operated by Codelio. For any question regarding these Terms, contact us
            at <a href="mailto:contact@codelio.fr">contact@codelio.fr</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Eligibility</h2>
          <p>
            You must be at least 13 years old (or the minimum age required in your country) to use
            the Service. By using it, you represent that you meet this requirement.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. License to use the Service</h2>
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable license to access and
            use the Service for your personal, non-commercial use, subject to these Terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful or fraudulent purpose.</li>
            <li>
              Scrape, crawl, or extract data from the Service in bulk without our prior written
              consent.
            </li>
            <li>
              Reverse-engineer, decompile, or attempt to extract the source code of the Service,
              except as permitted by law.
            </li>
            <li>
              Interfere with or disrupt the Service, including by overloading our servers, sending
              malicious requests, or attempting to bypass security controls.
            </li>
            <li>
              Interfere with the advertising that funds the Service (for example, by artificially
              clicking ads or automating interactions).
            </li>
            <li>
              Use the Service to build a competing product or to train machine-learning models
              without our explicit permission.
            </li>
            <li>
              Use the Service while driving or in any way that may endanger your safety or the
              safety of others.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Fuel price data &mdash; accuracy disclaimer</h2>
          <p>
            Fuel prices are provided by third parties, including governmental agencies, open data
            platforms, and retailer feeds. We make reasonable efforts to keep data accurate and
            up-to-date, but:
          </p>
          <ul>
            <li>Prices may have changed between the last update and your visit.</li>
            <li>Some stations may be missing, closed, or incorrectly geocoded.</li>
            <li>Posted prices at the pump always prevail over prices shown on the Service.</li>
          </ul>
          <p>
            The Service is provided for informational purposes only. Always verify the final price
            at the station before purchase.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Advertising</h2>
          <p>
            The Service is free to use and is funded by third-party advertising served by Google
            AdMob (mobile), Google AdSense (web), and other Google-certified partners. By using the
            Service, you acknowledge that ads will be displayed. Interactions with advertisements,
            including purchases or downloads, are solely between you and the advertiser. We are not
            responsible for the content, accuracy, or practices of third-party advertisers.
          </p>
          <p>
            More details about advertising partners and how to manage your ad preferences are
            available in our <a href="/privacy">Privacy Policy</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Third-party links and content</h2>
          <p>
            The Service may include links to third-party websites (e.g., government data portals,
            map providers). We do not control these sites and are not responsible for their
            content, privacy practices, or availability.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Intellectual property</h2>
          <p>
            All trademarks, logos, interface designs, and source code of the Service are the
            property of Codelio or its licensors and are protected by applicable laws. Fuel price
            data belongs to its respective providers (see the{' '}
            <a href="/sources">Data Sources</a> page) and is used under their open-data licenses or
            equivalent terms.
          </p>
          <p>
            Nothing in these Terms grants you any right, title, or interest in the Service other
            than the limited license set out in section 3.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Privacy</h2>
          <p>
            Your use of the Service is also governed by our{' '}
            <a href="/privacy">Privacy Policy</a>, which explains what data we collect and how we
            use it.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Disclaimer of warranties</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind,
            express or implied, including but not limited to merchantability, fitness for a
            particular purpose, non-infringement, accuracy, or uninterrupted availability.
          </p>
          <p>
            We do not warrant that fuel prices shown are accurate, complete, or current, and we do
            not guarantee that the Service will be free of errors, bugs, or security vulnerabilities.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Codelio, its directors, employees,
            and affiliates shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits, revenue, data, or use,
            arising out of or related to your use of the Service, even if we have been advised of
            the possibility of such damages.
          </p>
          <p>
            Our total aggregate liability for any claim related to the Service shall not exceed
            fifty euros (&euro;50).
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Codelio and its affiliates from any claim,
            liability, damage, loss, or expense (including reasonable legal fees) arising out of
            your breach of these Terms or your misuse of the Service.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time, without notice, if
            we believe you have violated these Terms or if required by law. You can stop using the
            Service at any time.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Changes to the Service and to these Terms</h2>
          <p>
            We may modify or discontinue the Service, in whole or in part, at any time. We may also
            update these Terms from time to time; the &quot;Last updated&quot; date at the top reflects
            the most recent revision. Continued use of the Service after changes constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>15. Governing law and jurisdiction</h2>
          <p>
            These Terms are governed by the laws of France, without regard to conflict-of-law
            principles. Any dispute that cannot be resolved amicably shall be submitted to the
            competent courts of France, subject to mandatory consumer-protection rules that may
            apply in your country of residence.
          </p>
        </section>

        <div className="legal-contact">
          <strong>Contact:</strong> Questions about these Terms? Reach out at{' '}
          <a href="mailto:contact@codelio.fr">contact@codelio.fr</a>.
        </div>
      </div>
    </div>
  );
}

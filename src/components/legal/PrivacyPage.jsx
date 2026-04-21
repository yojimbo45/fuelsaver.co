import './legal.css';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: April 21, 2026</p>

        <div className="legal-intro">
          <strong>Summary:</strong> FuelSaver helps you compare real-time fuel prices worldwide.
          We keep personal data to the strict minimum required to operate the service and to display
          relevant advertising. We do not sell your data. This policy explains what is collected,
          why, and how you can exercise your rights.
        </div>

        <section className="legal-section">
          <h2>1. Who we are</h2>
          <p>
            FuelSaver (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an independent service operated by Codelio,
            accessible at <a href="https://fuelsaver.one">https://fuelsaver.one</a> and through our mobile
            applications (the &quot;Service&quot;). For any privacy-related request, you can contact us at{' '}
            <a href="mailto:contact@codelio.fr">contact@codelio.fr</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Information we collect</h2>
          <p>
            We design the Service to work without requiring you to create an account. However, to
            deliver core features and to fund the Service through advertising, the following data
            may be collected:
          </p>

          <h3>a. Information you provide</h3>
          <ul>
            <li>Search queries (city names, addresses) you type to look for fuel prices.</li>
            <li>Origin and destination places you enter in the Trip Calculator.</li>
            <li>Optional location permission when you tap &quot;Locate me&quot;.</li>
            <li>Content of any message you send us by email.</li>
          </ul>

          <h3>b. Information collected automatically</h3>
          <ul>
            <li>
              <strong>Approximate or precise location</strong> (only if you grant permission) in order
              to show nearby stations.
            </li>
            <li>
              <strong>Technical data</strong>: IP address, device type, operating system, browser,
              language, referring page, and time of request — used for security, analytics, and fraud
              prevention.
            </li>
            <li>
              <strong>Usage data</strong>: pages viewed, fuel types selected, features used, and
              interactions with ads.
            </li>
            <li>
              <strong>Advertising identifiers</strong> (such as Google Advertising ID on Android,
              IDFA on iOS, or cookies on web) used by our ad partners to serve and measure ads.
            </li>
          </ul>

          <h3>c. Information we do NOT collect</h3>
          <ul>
            <li>We do not require a name, phone number, or account registration.</li>
            <li>We do not access your contacts, photos, microphone, or camera.</li>
            <li>We do not knowingly collect data from children under 13.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. How we use your information</h2>
          <ul>
            <li>To display fuel stations and prices near you.</li>
            <li>To compute trip fuel cost estimates.</li>
            <li>To remember your last location locally on your device for convenience.</li>
            <li>To operate, maintain, secure, and improve the Service.</li>
            <li>To display advertising and measure its performance.</li>
            <li>To comply with legal obligations and enforce our Terms of Use.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Advertising and Google AdMob / AdSense</h2>
          <p>
            The Service is free to use and is funded by advertising served by Google AdMob (mobile)
            and Google AdSense (web), as well as by other Google-certified advertising partners.
          </p>
          <p>
            These partners may use cookies, device identifiers (such as the Google Advertising ID),
            and similar technologies to:
          </p>
          <ul>
            <li>Serve ads based on your prior visits to this or other websites/apps.</li>
            <li>Measure ad performance and prevent fraudulent clicks.</li>
            <li>Show personalized or non-personalized ads depending on your consent.</li>
          </ul>
          <p>
            You can learn more about how Google uses data from sites or apps that use its services at{' '}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
              policies.google.com/technologies/partner-sites
            </a>.
          </p>
          <p>
            In the European Economic Area, United Kingdom, and Switzerland, we (or our CMP) ask for
            your consent before using identifiers for personalized advertising, in accordance with
            the GDPR and the ePrivacy Directive. You may withdraw your consent at any time from the
            cookie settings link in the app/site footer.
          </p>
          <p>
            To opt out of personalized ads on the web, visit{' '}
            <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer">youronlinechoices.eu</a>{' '}
            (EU), <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">optout.aboutads.info</a>{' '}
            (US), or Google&apos;s Ads Settings at{' '}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.
            On mobile, you can reset or limit ad tracking from your device settings (Android:
            Settings &gt; Privacy &gt; Ads; iOS: Settings &gt; Privacy &gt; Tracking).
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Cookies and local storage</h2>
          <p>We use the following categories of storage:</p>
          <ul>
            <li>
              <strong>Strictly necessary</strong>: remember your preferences (fuel type, last
              location, label style) using your browser&apos;s localStorage. These cannot be disabled.
            </li>
            <li>
              <strong>Analytics</strong>: aggregated, anonymized usage statistics to understand
              how the Service is used.
            </li>
            <li>
              <strong>Advertising</strong>: cookies or identifiers set by Google and its ad partners
              to serve and measure ads. Subject to consent in the EEA/UK/CH.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. Legal bases for processing (GDPR)</h2>
          <ul>
            <li>
              <strong>Performance of a contract</strong>: to provide the search, map, and trip
              calculator features.
            </li>
            <li>
              <strong>Legitimate interests</strong>: to secure the Service, prevent fraud, and
              serve non-personalized advertising.
            </li>
            <li>
              <strong>Consent</strong>: for location access, personalized advertising, and
              non-essential cookies.
            </li>
            <li><strong>Legal obligation</strong>: to comply with applicable laws.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>7. Sharing of data</h2>
          <p>We share data only with:</p>
          <ul>
            <li>
              <strong>Advertising partners</strong> (Google AdMob/AdSense and their certified
              partners) to serve and measure ads.
            </li>
            <li>
              <strong>Map and geocoding providers</strong> (e.g., OpenStreetMap, map tile providers)
              when you request a map view or place search.
            </li>
            <li>
              <strong>Hosting and CDN providers</strong> (e.g., Cloudflare) used to deliver the
              Service.
            </li>
            <li>
              <strong>Authorities</strong> when legally required.
            </li>
          </ul>
          <p>We do not sell or rent personal data to any third party.</p>
        </section>

        <section className="legal-section">
          <h2>8. International transfers</h2>
          <p>
            Our providers may process data in countries outside the EEA, including the United
            States. When this happens, the transfer is covered by appropriate safeguards such as
            Standard Contractual Clauses approved by the European Commission.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Data retention</h2>
          <ul>
            <li>Search queries and location are used in memory and not stored on our servers.</li>
            <li>Technical logs are kept for up to 30 days for security and debugging.</li>
            <li>
              Advertising identifiers are retained by our ad partners according to their own
              retention policies.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>10. Your rights</h2>
          <p>
            Depending on where you live (GDPR, UK GDPR, CCPA/CPRA, LGPD, etc.), you have the right
            to:
          </p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Withdraw your consent at any time.</li>
            <li>Request data portability.</li>
            <li>Lodge a complaint with your local data protection authority.</li>
            <li>(California) opt out of the &quot;sale&quot; or &quot;sharing&quot; of personal information.</li>
          </ul>
          <p>
            To exercise any of these rights, email{' '}
            <a href="mailto:contact@codelio.fr">contact@codelio.fr</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Children&apos;s privacy</h2>
          <p>
            The Service is not directed to children under 13 (or the equivalent minimum age in your
            jurisdiction). We do not knowingly collect personal data from children. If you believe a
            child has provided us with personal data, please contact us and we will delete it.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Security</h2>
          <p>
            We use HTTPS for all data in transit and apply reasonable technical and organizational
            measures to protect your information. No method of transmission or storage is, however,
            100% secure.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the
            top reflects the most recent revision. Continued use of the Service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <div className="legal-contact">
          <strong>Contact:</strong> For any question regarding this policy or your data, please
          reach out at <a href="mailto:contact@codelio.fr">contact@codelio.fr</a>.
        </div>
      </div>
    </div>
  );
}

# BidGuard autentifikacijos laiškai

## Confirm sign up

- Subject: `Patvirtinkite savo BidGuard paskyrą`
- Body: `confirmation.html`

## Reset password

- Subject: `Atkurkite BidGuard slaptažodį`
- Body: `recovery.html`

Hosted Supabase projekte šablonai įklijuojami per **Authentication → Email Templates**.

Kad siuntėjas būtų `BidGuard <noreply@bidguard.eu>`, reikia įjungti **Authentication → SMTP Settings → Custom SMTP**. Su Resend naudokite:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Sender name: `BidGuard`
- Sender email: `noreply@bidguard.eu`

Resend domenas turi būti patvirtintas jo pateiktais DKIM, SPF ir MX DNS įrašais.

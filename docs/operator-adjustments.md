# Operator bonuses and deductions

The Operations form stores both the recipient operator and an optional model/account. For `bonus`, `penalty`, and `internship`, that account is context and must not exclude the operation from the operator's payroll. Refunds still affect the relevant operator and model commissions. Payment routing for advances and salary payments is unchanged.

`operatorPayrollOperations` is shared by Dashboard, Reports, AdvanceRequest and the owner calculation. Callers scope operations to the selected period; the helper scopes them to the operator and excludes SYSTEM. Owner/Dashboard operator enumeration also excludes model and admin recipients.

This is a read-time calculation correction. It does not migrate records, alter amounts or paid markers, reopen periods, deduplicate payments, or change rates. It applies consistently to open and closed periods: a closed period remains protected from writes, but its displayed payroll/profit reflects the corrected formula. Closing a period does not switch calculation rules.

Validation: regression tests cover adjustments with and without an account, closed periods, refunds, excluded recipients, existing paid markers and two legitimate equal model advances. Local browser verification on a private copy exercises creation of an account-linked bonus and penalty, persistence through a mocked cloud API, reload, and agreement between Dashboard, Reports and AdvanceRequest. Private financial copies and verification reports are kept outside the repository.

```
1. WHY - Vision & Purpose

Purpose & Users

What problem are we solving and for whom?
	•	Primary Objective: Build a multi-vertical insurance lead-generation platform that:
	1.	Captures and validates high-quality consumer data,
	2.	Monetizes via both lead sales and click walls (RTB),
	3.	Dynamically leverages AI/ML to maximize lead value and revenue from each user session.
	•	Audience:
	•	Consumers: Individuals seeking quotes for Auto, Home, Renters, Health/Medicare, Life, and Commercial insurance.
	•	Agents/Carriers/Aggregators: Need high-quality leads or wish to place real-time bidding (RTB) offers on click walls.
	•	Why This Platform?
	•	AI-Enhanced Revenue Maximization: Using cutting-edge ML models to score leads in real time, ensuring each lead is sold at the highest price or monetized via the top-paying click offers.
	•	Flexible & Future-Proof: Modular funnel design to add new verticals, cross-sell opportunities, and direct-binding (Phase 2) seamlessly.
	•	Superior User Experience: Short multi-step forms, pre-fill data, real-time validations, and clear progress indicators.

2. WHAT - Core Requirements

Functional Requirements
	1.	Multi-Vertical Lead Capture & Validation
	•	System must handle Auto, Home, Renters, Health/Medicare, Life, and Commercial insurance forms.
	•	System must provide real-time validations (email, phone, address) to ensure data accuracy.
	•	System must collect all critical fields unique to each vertical (detailed below).
	2.	AI/ML Lead Scoring & RTB Optimization
	•	System must use machine learning models to score leads in real time based on user attributes, funnel behavior, and traffic source.
	•	System must feed these scores into RTB processes to either boost CPC bids (for the click wall) or increase lead sale price for high-value leads.
	•	System must adapt over time—learning from buyer acceptance, conversion rates, and source ROI.
	3.	Mandatory Click Wall Presentation
	•	System must display a click wall with real-time ads/offers on the Thank You page of every funnel completion, and on exit intent for users who abandon.
	•	System must integrate with multiple RTB partners (Quinstreet, Media Alpha, Kissterra, etc.) to fetch the highest CPC offers.
	4.	Self-Service Buyer Portal
	•	System must allow carriers/agents to create campaigns, set filters (geo, coverage, risk), manage budgets, and see real-time dashboards (leads, spend, ROI).
	•	System must provide AI-based recommendations on optimizing bids or targeting filters.
	5.	Cross-Sell & Bundling Logic
	•	System must dynamically prompt cross-sell offers (e.g., “Auto + Home bundle”) if relevant data signals are present (like homeownership).
	•	System must maintain short user flows—only additional fields if strictly necessary.
	6.	Future Direct-Bind Support (Phase 2)
	•	System must be architected to integrate direct-bind carriers seamlessly, letting qualified users skip the standard funnel steps.
	•	System must still show a click wall if direct bind is not completed.

3. HOW - Planning & Implementation

Technical Implementation

Required Stack Components
	•	Frontend:
	•	Modern Web Framework: React, Vue, or Angular to build dynamic, multi-step forms.
	•	Adaptive/Responsive: Must be highly optimized for mobile usage, as 70%+ of traffic may be mobile.
	•	Backend (Microservices):
	•	Funnel Service: Manages step-by-step logic, dynamic branching, partial save states.
	•	Validation Service: Connectors for phone/email/address, plus property data (Zillow/Realtor for Home) or partial VIN for Auto.
	•	Lead Distribution Service: Routes leads to buyers (ping/post), collects acceptance/rejection feedback.
	•	AI/ML Service: Real-time scoring engine that interfaces with funnel events and buyer feedback.
	•	RTB Aggregator: Sends user info (or anonymized data) to partners, retrieves CPC bids, selects top offers.
	•	Databases:
	•	SQL/NoSQL for storing leads, user sessions, buyer campaigns.
	•	Data Warehouse (Snowflake, Redshift) for advanced analytics and ML training data.
	•	Infrastructure:
	•	Cloud-Based (AWS, Azure, or GCP) with container orchestration (Kubernetes) for auto-scaling.
	•	Message Queue (Kafka or RabbitMQ) for event-driven data flows (funnel events, lead scoring, buyer feedback).

System Requirements
	•	Performance: Must handle large traffic spikes (tens of thousands of daily leads) with sub-second response times for validations and RTB calls.
	•	Security: PII encryption (AES-256 at rest, TLS in transit). Strict role-based access.
	•	Scalability: Stateless microservices, auto-scaling containers, horizontal partitioning for database load.
	•	Reliability: 99.9% uptime SLA, failover strategies if a microservice goes down.
	•	Integration Constraints: Buyer integration typically uses JSON or XML posting, RTB aggregator calls follow partner-defined specs.

User Experience

Key User Flows
	1.	Consumer Funnel Flow
	•	Entry Point: User clicks ad or visits domain → sees brand/vertical landing page.
	•	Form Steps (detailed below by vertical).
	•	AI/ML Scoring: System evaluates user data in real time, possibly changing question order or cross-sell prompts.
	•	Lead Completion: Data posted to lead buyers.
	•	Click Wall: Thank You page displays top RTB ads.
	•	Success: Valid lead captured; user sees relevant offers.
	2.	Exit Intent Flow
	•	Partial Data: As soon as user supplies minimal details (name, phone, etc.), system attempts to store partial lead.
	•	Pop-Up/New Tab: If user tries to abandon, show an RTB-based click wall.
	•	AI-Driven: If user is high potential but about to exit, system might offer an incentive (like “Complete now to see quotes”).
	3.	Buyer Portal Flow
	•	Login & Onboarding: Buyer sets up account, licenses, billing info.
	•	Campaign Creation: Filters (geo, coverage type, risk acceptance), daily budget, max CPL.
	•	Real-Time Dashboard: Sees leads in near real time, acceptance rate, spend, ROI, AI-based suggestions to optimize.
	•	Success: Buyer can easily scale up or refine campaigns for better results.

Core Interfaces
	1.	Consumer Funnel UI
	•	Multi-Step Wizard: Each step collects essential data. Inline validations and easy-to-use dropdowns/sliders.
	•	Progress Bar: Clearly indicates steps to reduce abandonment.
	•	Tooltips & Inline Help: Explains coverage terms (e.g., “Collision Coverage”).
	2.	Click Wall
	•	Thank You Page: Displays top CPC ads, brand logos, short messages.
	•	Exit-Intent: Pop-up or separate tab with relevant insurance or adjacent offers.
	3.	Buyer Portal
	•	Campaign Config Screen: Set filters and bids, add negative keywords or traffic sources to exclude.
	•	Reporting Dashboard: Graphs for lead volume, cost, accepted leads, AI insights.
	•	Notifications/Alerts: e.g., “You’re close to daily budget” or “AI suggests raising your CPL by 10% in TX Zip Codes.”

Business Requirements

Access & Authentication
	•	Consumer Side: Anonymous usage for funnel.
	•	Buyer Portal: Username/password, optional 2FA for enterprise clients. Possibly separate roles (admin vs. view-only).

Business Rules
	1.	AI/ML Priority:
	•	Immediate: Must be included from launch to optimize RTB bids and lead sale pricing.
	•	Adaptive: Models refine themselves daily using buyer feedback loops (accept, reject, conversions).
	2.	Data Validation:
	•	Real-time checks on phone/email/address are mandatory for lead submission.
	•	Invalid or incomplete leads can still be partially monetized (exit-intent click wall).
	3.	Compliance & Security:
	•	TCPA disclaimers embedded near final submission button (no forced checkboxes needed, but must be visible).
	•	PII Encryption at rest (AES-256), TLS for all data in transit.
	•	Retention & Deletion: Align with state/federal guidelines.
	4.	Mandatory Click Wall:
	•	Every completed funnel user sees RTB ads.
	•	Mid-funnel exit-intent also triggers an RTB page or pop-up.

Detailed Vertical Fields

Below are key fields required for each vertical funnel. Note: Minimizing friction is crucial, so the system uses pre-fill APIs (e.g., partial VIN lookup, property data from Zillow/Realtor) when possible.
	1.	Auto Insurance
	•	Vehicle Info: Year, Make, Model, (Partial) VIN, Ownership (owned/financed/leased), Annual Mileage.
	•	Driver Info: License Status, Years Driving, Accidents/Violations, Education Level.
	•	Coverage: Current Provider, Expiration Date, Coverage Levels, Continuous Coverage.
	•	Contact: Name, DOB, Phone (validated), Email (validated), Address (validated).
	2.	Home Insurance
	•	Property Details: Address → auto-fetch Year Built, Square Footage, Construction Type, Roof Age.
	•	Occupancy & Usage: Primary Residence vs. Rental, # Residents, Safety Features (smoke alarms).
	•	Coverage: Current Provider, Dwelling Coverage, Liability, Additional Riders (Flood, Earthquake).
	•	Contact: Name, Phone, Email, validated Address.
	3.	Renters Insurance
	•	Rental Property: Address, Type (Apartment, Duplex), monthly rent.
	•	Personal Property: Value of belongings, special items (electronics/jewelry).
	•	Coverage: Current Provider, extra coverage for high-value items.
	•	Contact: Name, Phone, Email.
	4.	Health/Medicare
	•	Personal Info: Age, Gender, Household Size, Income (for ACA subsidies).
	•	Health Status: Pre-existing conditions, medications.
	•	Medicare: If 65+, check Part A/B status, desire for Part C/D.
	•	Contact: Name, Phone, Email, validated Address.
	5.	Life Insurance
	•	Purpose: Family protection, mortgage coverage, final expenses.
	•	Health Info: Smoker status, major conditions, height/weight.
	•	Coverage: Term vs. Whole, desired coverage amount.
	•	Contact: Name, Phone, Email, Address.
	6.	Commercial Insurance (Auto, General Liability)
	•	Business Details: Name, Address, Industry, Years in operation.
	•	Coverage Inquiry: Commercial auto (# of vehicles), general liability limits, worker’s comp needs.
	•	Contact: Business phone, email, owner name.

Implementation Priorities
	1.	High Priority
	•	AI/ML Scoring & Real-Time RTB Optimization: Must be integrated from the start to maximize lead sale prices and click wall revenue.
	•	Multi-Vertical Funnel with Real-Time Validation: Capturing essential fields in short steps, ensuring high lead quality.
	•	Mandatory Click Wall: Thank You + exit-intent (pop-up or new tab).
	•	Self-Service Buyer Portal: Basic campaign creation, real-time dashboards.
	2.	Medium Priority
	•	Advanced Cross-Sell: Automatic bundling prompts across verticals (Auto + Home, etc.).
	•	Property / VIN Pre-Fill: Deeper integration with Zillow/Realtor and partial VIN lookups for frictionless input.
	•	Marketing Attribution: Detailed sub-ID tracking, dynamic session monitoring, advanced funnel analytics.
	3.	Lower Priority / Future
	•	Direct-Bind Phase 2: Carriers offering real-time underwriting and immediate policy binding.
	•	AI Chatbot: Interactive funnel guidance or agent triage for complex questions.
	•	Geo-Fencing & Localization: Multi-language support or highly localized disclaimers.

4. Key Prompting Principles
	1.	Focus on What Matters: The immediate must-haves are AI/ML lead scoring and real-time RTB monetization for each user, plus validated data collection across all major insurance verticals.
	2.	Give Context: The advanced user flows (exit-intent monetization, cross-sell) rely on the system’s real-time data checks and ML insights.
	3.	Be Concise: Each vertical funnel is short, with optional expansions only if the ML model predicts a high-likelihood close.
	4.	Enhance with Templates: Could add data schemas (JSON structures) for each vertical’s lead format, integration docs for each RTB partner, and step-by-step question branching logic.
	5.	Make It Yours: Future expansions can incorporate direct binding, deeper personalization, or additional third-party data sets for advanced segmentation.
```
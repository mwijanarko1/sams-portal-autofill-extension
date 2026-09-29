# University of Greenwich portal field map

**Origin:** `https://nelson.gre.ac.uk`  
**System:** Ellucian Banner Self-Service Admissions RELEASE 8.7.2  

## Checklist sections discovered

Name, Employment / Supporting Info., Permanent Address, Referee Details, Mailing Address, Qualifications, Statistical Information, Previous / Current Education, Programme Information, Signature

## Global blocks

Login/PIN/reCAPTCHA, all submits (Continue/Submit/Fill Out Application), EXIT, Signature submit.

## Application Checklist

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskalog.P_DispIndex?appno=1`

_No fillable fields on this page (nav/menu/checklist)._

## Name

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskanam.P_DispAppName?appno=1&wsct=NAME`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Title | `select` | `pfx` / `pfx` | `#pfx` |  (``) · Mr (`Mr`) · Miss (`Miss`) · Dr (`Dr`) · Ms (`Ms`) · Mrs (`Mrs`) · Prof (`Prof`) · Mx (`Mx`) | `title` | mapped_guess |
| First Name | `text` | `fname` / `fname` | `#fname` | - | `givenName` | mapped_guess |
| Middle Name | `text` | `mname` / `mname` | `#mname` | - | `middleName` | mapped_guess |
| Family Name | `text` | `lname` / `lname` | `#lname` | - | `familyName` | mapped_guess |
| Previous Name (first name + middle name + family name) | `text` | `plname` / `plname` | `#plname` | - | `previousName` | mapped_guess |
| Full Legal Name | `text` | `ud50` / `ud50` | `#ud50` | - | `-` | portal_or_unmapped |
| Passport Number (Non EU applicants only) | `text` | `ud135` / `ud135` | `#ud135` | - | `passportNumber` | mapped_guess |
| Have you Previously applied to the University of Greenwich? | `radio` | `ud1` / `None` | `[name='ud1']` | `Y` / `N` | `-` | portal_only |
| Have you Previously applied to the University of Greenwich? | `radio` | `ud1` / `ud1` | `#ud1` | `Y` / `N` | `-` | portal_only |
| Please provide your previous 9 digit ID number or student number (if known) | `text` | `ud2` / `ud2` | `#ud2` | - | `-` | portal_or_unmapped |
| If you applied through an International Agent please state their 9 digit ID number | `text` | `ud3` / `ud3` | `#ud3` | - | `-` | portal_only |

## Employment / Supporting Info.

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskaess.P_DispAppEssay?appno=1&wsct=ESSAY`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Name and Address of Employer | `textarea` | `ud11` / `ud11` | `#ud11` | - | `cvCurrentEmployer` | mapped_guess |
| Description of Job / Nature of Employment | `text` | `ud16` / `ud16` | `#ud16` | - | `-` | portal_or_unmapped |
| Full or Part Time? | `radio` | `ud12` / `ud12` | `#ud12` | `Y` / `N` | `-` | portal_or_unmapped |
| Employment Start Date | `select` | `bday_dd` / `bday_dd` | `#bday_dd` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `-` | blocked_until_split_date |
| Employment Start Date | `select` | `bday_mm` / `bday_mm` | `#bday_mm` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | blocked_until_split_date |
| Employment Start Date | `select` | `bday_yyyy` / `bday_yyyy` | `#bday_yyyy` |  (``) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) · 2021 (`2021`) · 2020 (`2020`) ... +24 | `-` | blocked_until_split_date |
| Employment End Date | `select` | `bday_dd2` / `bday_dd2` | `#bday_dd2` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `-` | portal_or_unmapped |
| Employment End Date | `select` | `bday_mm2` / `bday_mm2` | `#bday_mm2` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | portal_or_unmapped |
| Employment End Date | `select` | `bday_yyyy2` / `bday_yyyy2` | `#bday_yyyy2` |  (``) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) · 2021 (`2021`) · 2020 (`2020`) ... +24 | `-` | portal_or_unmapped |
| Personal Statement (max 3950 characters) | `textarea` | `p_sarstmt_desc` / `p_sarstmt_desc` | `#p_sarstmt_desc` | - | `state` | mapped_guess |

## Permanent Address

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskaadr.P_DispAppAddr1?appno=1&wsct=ADDR1`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Postcode | `text` | `searchzip` / `searchzip` | `#searchzip` | - | `postcode` | mapped_guess |
| Postcode | `submit` | `search_btn` / `search_btn` | `#search_btn` | - | `-` | blocked_submit |
| Address | `select` | `addr1` / `None` | `[name='addr1']` | Please select your address... (``) | `-` | portal_or_unmapped |
| Town | `text` | `city` / `city` | `#city` | - | `city` | mapped_guess |
| Postcode | `text` | `zip` / `zip` | `#zip` | - | `postcode` | mapped_guess |
| Home Telephone No. | `text` | `hometelno` / `hometelno` | `#hometelno` | - | `phone` | mapped_guess |
| Mobile Telephone No. | `text` | `mobiletelno` / `mobiletelno` | `#mobiletelno` | - | `phone` | mapped_guess |
| Mailing address same as permanent address? | `radio` | `addrflag` / `addrflag` | `#addrflag` | `Y` / `N` | `-` | portal_or_unmapped |

## Referee Details

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskaudf.P_DispAppUserDef?appno=1&wsct=ADDITIONAL`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Name of Referee | `text` | `ud17` / `ud17` | `#ud17` | - | `-`17blocked_referee |
| E-mail Address | `text` | `ud18` / `ud18` | `#ud18` | - | `-`18blocked_referee |
| Address Line 1 | `text` | `ud19` / `ud19` | `#ud19` | - | `-`19blocked_referee |
| Address Line 2 | `text` | `ud20` / `ud20` | `#ud20` | - | `-`20blocked_referee |
| Address Line 3 | `text` | `ud21` / `ud21` | `#ud21` | - | `-`21blocked_referee |
| City | `text` | `ud22` / `ud22` | `#ud22` | - | `-`22blocked_referee |
| Postcode | `text` | `ud23` / `ud23` | `#ud23` | - | `-`23blocked_referee |
| Country | `select` | `ud24` / `ud24` | `#ud24` |  (``) · Afghanistan (`1602`) · Albania (`1603`) · Alderney (`1592`) · Algeria (`1604`) · American Samoa (`2010`) · Andorra (`1605`) · Angola (`1606`) ... +241 | `-`24blocked_referee |
| Telephone Number | `text` | `ud25` / `ud25` | `#ud25` | - | `-`25blocked_referee |
| Fax Number | `text` | `ud26` / `ud26` | `#ud26` | - | `-`26blocked_referee |
| Organisation Name | `text` | `ud27` / `ud27` | `#ud27` | - | `-`27blocked_referee |
| Post / Occupation / Relationship to Applicant | `text` | `ud28` / `ud28` | `#ud28` | - | `-`28blocked_referee |
| How long have you known this applicant / referee? | `text` | `ud29` / `ud29` | `#ud29` | - | `-`29blocked_referee |
| If you already have a reference please paste here (max 2000 characters) | `textarea` | `ud30` / `ud30` | `#ud30` | - | `-`30blocked_referee |

## Mailing Address

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskaadr.P_DispAppAddr2?appno=1&wsct=ADDR2`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Postcode | `text` | `searchzip` / `searchzip` | `#searchzip` | - | `postcode` | mapped_guess |
| Postcode | `submit` | `search_btn` / `search_btn` | `#search_btn` | - | `-` | blocked_submit |
| Address | `select` | `addr1` / `None` | `[name='addr1']` | Please select your address... (``) | `-` | portal_or_unmapped |
| Town | `text` | `city` / `city` | `#city` | - | `city` | mapped_guess |
| Postcode | `text` | `zip` / `zip` | `#zip` | - | `postcode` | mapped_guess |
| Home Telephone No. | `text` | `hometelno` / `hometelno` | `#hometelno` | - | `phone` | mapped_guess |

## Qualifications

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskapcl.P_DispQuals?appno=1&wsct=QUALS`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Level | `text` | `ud91qualtype` / `ud91qualtype` | `#ud91qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud91subject` / `ud91subject` | `#ud91subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud91grade` / `ud91grade` | `#ud91grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud91month` / `ud91month` | `#ud91month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud91year` / `ud91year` | `#ud91year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud92qualtype` / `ud92qualtype` | `#ud92qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud92subject` / `ud92subject` | `#ud92subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud92grade` / `ud92grade` | `#ud92grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud92month` / `ud92month` | `#ud92month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud92year` / `ud92year` | `#ud92year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud93qualtype` / `ud93qualtype` | `#ud93qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud93subject` / `ud93subject` | `#ud93subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud93grade` / `ud93grade` | `#ud93grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud93month` / `ud93month` | `#ud93month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud93year` / `ud93year` | `#ud93year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud94qualtype` / `ud94qualtype` | `#ud94qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud94subject` / `ud94subject` | `#ud94subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud94grade` / `ud94grade` | `#ud94grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud94month` / `ud94month` | `#ud94month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud94year` / `ud94year` | `#ud94year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud95qualtype` / `ud95qualtype` | `#ud95qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud95subject` / `ud95subject` | `#ud95subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud95grade` / `ud95grade` | `#ud95grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud95month` / `ud95month` | `#ud95month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud95year` / `ud95year` | `#ud95year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud96qualtype` / `ud96qualtype` | `#ud96qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud96subject` / `ud96subject` | `#ud96subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud96grade` / `ud96grade` | `#ud96grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud96month` / `ud96month` | `#ud96month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud96year` / `ud96year` | `#ud96year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud97qualtype` / `ud97qualtype` | `#ud97qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud97subject` / `ud97subject` | `#ud97subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud97grade` / `ud97grade` | `#ud97grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud97month` / `ud97month` | `#ud97month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud97year` / `ud97year` | `#ud97year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud98qualtype` / `ud98qualtype` | `#ud98qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud98subject` / `ud98subject` | `#ud98subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud98grade` / `ud98grade` | `#ud98grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud98month` / `ud98month` | `#ud98month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud98year` / `ud98year` | `#ud98year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud99qualtype` / `ud99qualtype` | `#ud99qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud99subject` / `ud99subject` | `#ud99subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud99grade` / `ud99grade` | `#ud99grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud99month` / `ud99month` | `#ud99month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud99year` / `ud99year` | `#ud99year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud100qualtype` / `ud100qualtype` | `#ud100qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud100subject` / `ud100subject` | `#ud100subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud100grade` / `ud100grade` | `#ud100grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud100month` / `ud100month` | `#ud100month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud100year` / `ud100year` | `#ud100year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud101qualtype` / `ud101qualtype` | `#ud101qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud101subject` / `ud101subject` | `#ud101subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud101grade` / `ud101grade` | `#ud101grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud101month` / `ud101month` | `#ud101month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud101year` / `ud101year` | `#ud101year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud102qualtype` / `ud102qualtype` | `#ud102qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud102subject` / `ud102subject` | `#ud102subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud102grade` / `ud102grade` | `#ud102grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud102month` / `ud102month` | `#ud102month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud102year` / `ud102year` | `#ud102year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud103qualtype` / `ud103qualtype` | `#ud103qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud103subject` / `ud103subject` | `#ud103subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud103grade` / `ud103grade` | `#ud103grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud103month` / `ud103month` | `#ud103month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud103year` / `ud103year` | `#ud103year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud104qualtype` / `ud104qualtype` | `#ud104qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud104subject` / `ud104subject` | `#ud104subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud104grade` / `ud104grade` | `#ud104grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud104month` / `ud104month` | `#ud104month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud104year` / `ud104year` | `#ud104year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud105qualtype` / `ud105qualtype` | `#ud105qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud105subject` / `ud105subject` | `#ud105subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud105grade` / `ud105grade` | `#ud105grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud105month` / `ud105month` | `#ud105month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud105year` / `ud105year` | `#ud105year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud106qualtype` / `ud106qualtype` | `#ud106qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud106subject` / `ud106subject` | `#ud106subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud106grade` / `ud106grade` | `#ud106grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud106month` / `ud106month` | `#ud106month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud106year` / `ud106year` | `#ud106year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud107qualtype` / `ud107qualtype` | `#ud107qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud107subject` / `ud107subject` | `#ud107subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud107grade` / `ud107grade` | `#ud107grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud107month` / `ud107month` | `#ud107month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud107year` / `ud107year` | `#ud107year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud108qualtype` / `ud108qualtype` | `#ud108qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud108subject` / `ud108subject` | `#ud108subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud108grade` / `ud108grade` | `#ud108grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud108month` / `ud108month` | `#ud108month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud108year` / `ud108year` | `#ud108year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud109qualtype` / `ud109qualtype` | `#ud109qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud109subject` / `ud109subject` | `#ud109subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud109grade` / `ud109grade` | `#ud109grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud109month` / `ud109month` | `#ud109month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud109year` / `ud109year` | `#ud109year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |
| Level | `text` | `ud110qualtype` / `ud110qualtype` | `#ud110qualtype` | - | `qualificationLevel` | mapped_guess |
| Subject including Modules or Units | `text` | `ud110subject` / `ud110subject` | `#ud110subject` | - | `major` | mapped_guess |
| Grade leave blank if pending | `text` | `ud110grade` / `ud110grade` | `#ud110grade` | - | `grade` | mapped_guess |
| Date Awarded / Expected | `select` | `ud110month` / `ud110month` | `#ud110month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `degree` | mapped_guess |
| Date Awarded / Expected | `select` | `ud110year` / `ud110year` | `#ud110year` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +64 | `degree` | mapped_guess |

## Statistical Information

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskaper.P_DispAppPersonal?appno=1&wsct=PERSONAL`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| E-mail Address | `text` | `email` / `email` | `#email` | - | `email` | mapped_guess |
| Verify e-mail address | `text` | `dup_email` / `dup_email` | `#dup_email` | - | `email` | mapped_guess |
| Gender | `select` | `gender` / `gender` | `#gender` |  (``) · Male (`M`) · Female (`F`) | `gender` | mapped_guess |
| Date of Birth | `select` | `bday_dd` / `bday_dd` | `#bday_dd` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `-` | blocked_until_split_date |
| Date of Birth | `select` | `bday_mm` / `bday_mm` | `#bday_mm` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | blocked_until_split_date |
| Date of Birth | `select` | `bday_yyyy` / `bday_yyyy` | `#bday_yyyy` |  (``) · 2011 (`2011`) · 2010 (`2010`) · 2009 (`2009`) · 2008 (`2008`) · 2007 (`2007`) · 2006 (`2006`) · 2005 (`2005`) ... +54 | `-` | blocked_until_split_date |
| Ethnicity | `select` | `ethn` / `ethn` | `#ethn` |  (``) · Arab (`50`) · Asian\Asian Brit - Bangladeshi (`33`) · Asian\Asian Brit - Indian (`31`) · Asian\Asian Brit - Pakistani (`32`) · Black\Black Brit - African (`22`) · Black\Black Brit - Caribbean (`21`) · Chinese (`34`) ... +12 | `-` | portal_only |
| Disability/Special Needs Information (Hold down the Ctrl (windows) / Command (Mac) button to select multiple options.) | `select` | `medi` / `medi` | `#medi` | No disability (`00`) · You have two or more impairments and/or disabling medical conditions (`08`) · You have a specific learning difficulty such as dyslexia, dyspraxia or AD(H)D (`51`) · You have a social/communication impairment such as Asperger's syndrome/other autistic spectrum disorder (`53`) · You have a long standing illness or health condition such as cancer, HIV, diabetes, chronic heart disease, or epilepsy (`54`) · You have a mental health condition, such as depression, schizophrenia or anxiety disorder (`55`) · You have physical impairment or mobility issues, such as difficulty using your arms or using a wheelchair or crutches (`56`) · You are deaf or have a serious hearing impairment (`57`) ... +2 | `-` | portal_or_unmapped |
| Enter any disability not listed above | `text` | `ud80` / `ud80` | `#ud80` | - | `-` | portal_or_unmapped |
| Have you been in care? | `radio` | `ud4` / `ud4` | `#ud4` | `1` / `2` / `7` | `-` | portal_or_unmapped |
| Have your parent(s)/guardian(s) attended Higher Education? | `radio` | `ud5` / `ud5` | `#ud5` | `1` / `2` / `8` | `-` | portal_or_unmapped |
| Date of First Entry to the UK (Please indicate whether this is your date of birth or enter the actual or intended date. If you are not planning to study in the UK, for example if you are applying to Greenwich Online, ple | `checkbox` | `ud204` / `None` | `[name='ud204']` | - | `dateOfBirth` | mapped_guess |
| Date of First Entry to the UK (Please indicate whether this is your date of birth or enter the actual or intended date. If you are not planning to study in the UK, for example if you are applying to Greenwich Online, ple | `select` | `euk_dd` / `euk_dd` | `#euk_dd` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `dateOfBirth` | mapped_guess |
| Date of First Entry to the UK (Please indicate whether this is your date of birth or enter the actual or intended date. If you are not planning to study in the UK, for example if you are applying to Greenwich Online, ple | `select` | `euk_mm` / `euk_mm` | `#euk_mm` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `dateOfBirth` | mapped_guess |
| Date of First Entry to the UK (Please indicate whether this is your date of birth or enter the actual or intended date. If you are not planning to study in the UK, for example if you are applying to Greenwich Online, ple | `select` | `euk_yyyy` / `euk_yyyy` | `#euk_yyyy` |  (``) · 2028 (`2028`) · 2027 (`2027`) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) ... +76 | `dateOfBirth` | mapped_guess |
| Country of Birth | `select` | `ud60` / `ud60` | `#ud60` |  (``) · Afghanistan (`1602`) · Albania (`1603`) · Alderney (`1592`) · Algeria (`1604`) · American Samoa (`2010`) · Andorra (`1605`) · Angola (`1606`) ... +248 | `countryOfBirth` | mapped_guess |
| Nationality | `select` | `ud65` / `ud65` | `#ud65` |  (``) · Afghanistan (`1602`) · Albania (`1603`) · Alderney (`1592`) · Algeria (`1604`) · American Samoa (`2010`) · Andorra (`1605`) · Angola (`1606`) ... +245 | `nationality` | mapped_guess |
| Area of Permanent Residence (UK residents please select your county) | `select` | `ud70` / `ud70` | `#ud70` |  (``) · Aberdeen (`161`) · Aberdeen (`161`) · Aberdeenshire (`162`) · Aberdeenshire (`162`) · Afghanistan (`602`) · Aland Islands (`853`) · Albania (`603`) ... +505 | `state` | mapped_guess |
| Who do you expect to pay your fees? | `select` | `ud35` / `ud35` | `#ud35` |  (``) · Entire cost of tuition fees is paid by private finance. (`01`) · Applying for student support assessment by LEA, SAAS, Northern Ireland Education and Library Board, DfES or Channel Islands or Isle of Man agency. (`02`) · Contribution from a Research Council. (`04`) · Contribution from the Department of Health or a Regional Health Authority. (`05`) · Overseas student award from the UK government or the British Council. (`06`) · Contribution from a training agency. (`07`) · Other UK government award. (`08`) ... +5 | `-` | portal_or_unmapped |
| State any dates you are not available for interview | `text` | `ud8` / `ud8` | `#ud8` | - | `state` | mapped_guess |
| Confidential Contact Name Please refer to notes relating to nominated access | `text` | `ud40` / `ud40` | `#ud40` | - | `-` | portal_or_unmapped |
| Confidential Contact Password | `text` | `ud45` / `ud45` | `#ud45` | - | `-` | portal_or_unmapped |

## Previous / Current Education

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskapcl.P_DispAppPrvCollege?appno=1&wsct=PRVCOLLEGE`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Institution Name | `text` | `col_name` / `col_name` | `#col_name` | - | `institutionName` | mapped_guess |
| Street1 | `text` | `addr1` / `addr1` | `#addr1` | - | `location` | mapped_guess |
| Street2 | `text` | `addr2` / `addr2` | `#addr2` | - | `location` | mapped_guess |
| Street3 | `text` | `addr3` / `addr3` | `#addr3` | - | `location` | mapped_guess |
| City | `text` | `city` / `city` | `#city` | - | `city` | mapped_guess |
| Postcode | `text` | `zip` / `zip` | `#zip` | - | `postcode` | mapped_guess |
| Country | `select` | `natn` / `natn` | `#natn` | ---------Select your country----------- (``) · Afghanistan (`1602`) · Albania (`1603`) · Alderney (`1592`) · Algeria (`1604`) · American Samoa (`2010`) · Andorra (`1605`) · Angola (`1606`) ... +241 | `countryName` | mapped_guess |
| Attended From | `select` | `beg_date_dd` / `beg_date_dd` | `#beg_date_dd` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `-` | portal_or_unmapped |
| Attended From | `select` | `beg_date_mm` / `beg_date_mm` | `#beg_date_mm` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | portal_or_unmapped |
| Attended From | `select` | `beg_date_yyyy` / `beg_date_yyyy` | `#beg_date_yyyy` |  (``) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) · 2021 (`2021`) · 2020 (`2020`) ... +54 | `-` | portal_or_unmapped |
| Attended To | `select` | `end_date_dd` / `end_date_dd` | `#end_date_dd` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +24 | `-` | portal_or_unmapped |
| Attended To | `select` | `end_date_mm` / `end_date_mm` | `#end_date_mm` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | portal_or_unmapped |
| Attended To | `select` | `end_date_yyyy` / `end_date_yyyy` | `#end_date_yyyy` |  (``) · 2026 (`2026`) · 2025 (`2025`) · 2024 (`2024`) · 2023 (`2023`) · 2022 (`2022`) · 2021 (`2021`) · 2020 (`2020`) ... +54 | `-` | portal_or_unmapped |

## Programme Information

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskapln.P_DispAppPlan?appno=1&wsct=PLAN`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| Month/Year of Entry | `select` | `p_month` / `p_month` | `#p_month` |  (``) · 01 (`01`) · 02 (`02`) · 03 (`03`) · 04 (`04`) · 05 (`05`) · 06 (`06`) · 07 (`07`) ... +5 | `-` | portal_or_unmapped |
| Month/Year of Entry | `select` | `p_year` / `p_year` | `#p_year` |  (``) · 2026 (`2026`) · 2027 (`2027`) · 2028 (`2028`) | `-` | portal_or_unmapped |
| Programme of Study | `select` | `p_program_code` / `p_program_code` | `#p_program_code` | -- Please select a programme -- (``) | `preferredCourse` | mapped_guess |
| Mode/Point of Entry | `select` | `p_mode_poe` / `p_mode_poe` | `#p_mode_poe` | -- Please select a Mode/PoE -- (``) | `-` | portal_or_unmapped |
| If you are applying for post 16/adult teacher training please indicate which subject(s) you wish to teach | `text` | `ud138` / `ud138` | `#ud138` | - | `major` | mapped_guess |

## Signature

**URL:** `https://nelson.gre.ac.uk/pls/prod/bwskanam.P_Signature?appno=1&wsct=SIGNATURE`

| Portal field | Type | name / id | Selector | Options (sample) | CRM key | Status |
|---|---|---|---|---|---|---|
| I agree to the Terms and Conditions | `checkbox` | `ud130` / `ud130` | `#ud130` | - | `-` | portal_or_unmapped |
| I have read the Guidance Notes | `checkbox` | `ud131` / `ud131` | `#ud131` | - | `-` | portal_or_unmapped |



## Extension mapping status (config)

Inventory rows above may still say `mapped_guess` from the live scrape. That is the discovery label, not a guarantee that the extension will fill the field.

### Shipped in `config/portals/greenwich.js` (safe overrides only)

- Name: `#fname` `#mname` `#lname` `#plname` `#pfx`
- Passport: `#ud135`
- Applicant email: `#email` `#dup_email` (not referee)
- Applicant phone: `#mobiletelno` `#hometelno` (not referee)
- Personal: `#gender` `#ud65` `#ud60`
- Education first row: `#col_name` `#ud91qualtype` `#ud91subject` `#ud91grade`
- Programme: `#p_program_code`
- Employment employer text: `#ud11`
- Personal statement: `#p_sarstmt_desc`
- Funding: `#ud35`

### Explicitly NOT overridden (unsafe until engine support)

- `dateOfBirth` / `#bday_dd` `#bday_mm` `#bday_yyyy` (split selects; also reused on Employment Start Date)
- `location` `city` `postcode` / `#addr1` `#city` `#zip` (shared with institution address on education)

### Blocked from fill (`blockedControls`)

- Auth, submits, signature, postcode search
- All `#bday_dd` `#bday_mm` `#bday_yyyy`
- Referee `#ud17` through `#ud30`
- Ethnicity remains unmapped (`#ethn`); do not treat as `city`

### Fixtures

Live HTML/screenshots stay local under `tmp/` (gitignored). No sanitized fixtures are in-repo yet.

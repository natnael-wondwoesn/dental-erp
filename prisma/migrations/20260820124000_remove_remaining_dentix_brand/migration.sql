UPDATE `Hospital`
SET
  `name` = 'Sunny Smile Speciality Clinic',
  `email` = CASE
    WHEN LOWER(`email`) LIKE '%@dentix.et' THEN 'hello@sunnysmile.et'
    ELSE `email`
  END,
  `website` = CASE
    WHEN LOWER(COALESCE(`website`, '')) LIKE '%dentix%' THEN 'www.sunnysmile.et'
    ELSE `website`
  END,
  `upiId` = CASE
    WHEN LOWER(COALESCE(`upiId`, '')) LIKE '%dentix%' THEN 'sunnysmile@telebirr'
    ELSE `upiId`
  END
WHERE LOWER(`name`) LIKE '%dentix%';

UPDATE `User`
SET `email` = REPLACE(LOWER(`email`), '@dentix.et', '@sunnysmile.et')
WHERE LOWER(`email`) LIKE '%@dentix.et';

UPDATE `Staff`
SET `email` = REPLACE(LOWER(`email`), '@dentix.et', '@sunnysmile.et')
WHERE LOWER(`email`) LIKE '%@dentix.et';

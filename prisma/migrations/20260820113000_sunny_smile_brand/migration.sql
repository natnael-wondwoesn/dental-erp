UPDATE `Hospital`
SET
  `name` = 'Sunny Smile Speciality Clinic',
  `email` = CASE WHEN `email` = 'hello@dentix.et' THEN 'hello@sunnysmile.et' ELSE `email` END,
  `website` = CASE WHEN `website` = 'www.dentix.et' THEN 'www.sunnysmile.et' ELSE `website` END,
  `upiId` = CASE WHEN `upiId` = 'dentix@telebirr' THEN 'sunnysmile@telebirr' ELSE `upiId` END
WHERE `name` IN ('Dentix', 'Dentix Dental Clinic');

UPDATE `User`
SET `email` = REPLACE(`email`, '@dentix.et', '@sunnysmile.et')
WHERE `email` LIKE '%@dentix.et';

UPDATE `Staff`
SET `email` = REPLACE(`email`, '@dentix.et', '@sunnysmile.et')
WHERE `email` LIKE '%@dentix.et';

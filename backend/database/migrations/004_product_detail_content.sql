CREATE TABLE IF NOT EXISTS product_details (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  release_date VARCHAR(50) NULL,
  publisher VARCHAR(180) NULL,
  developer VARCHAR(180) NULL,
  genres TEXT NULL,
  languages TEXT NULL,
  source_url VARCHAR(500) NULL,
  CONSTRAINT fk_product_details_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_description_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  heading VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_product_description_sections_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_description_order (product_id, sort_order),
  INDEX idx_product_description_sections_order (product_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_rating_summaries (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  overall_rating DECIMAL(3, 2) NULL,
  gameplay_rating DECIMAL(3, 2) NULL,
  story_rating DECIMAL(3, 2) NULL,
  graphics_rating DECIMAL(3, 2) NULL,
  soundtrack_rating DECIMAL(3, 2) NULL,
  CONSTRAINT fk_product_rating_summaries_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS offer_cashbacks (
  offer_id BIGINT UNSIGNED PRIMARY KEY,
  cashback_percent DECIMAL(5, 2) NOT NULL,
  CONSTRAINT fk_offer_cashbacks_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO product_details
  (product_id, release_date, publisher, developer, genres, languages, source_url)
VALUES
  (1, 'Dec 9, 2020', 'CD PROJEKT RED', 'CD PROJEKT RED', 'RPG', 'English, French, Italian, German, Spanish - Spain, Arabic, Czech, Hungarian, Japanese, Korean, Polish, Portuguese - Brazil, Russian, Simplified Chinese, Spanish - Latin America, Thai, Traditional Chinese, Turkish, Ukrainian', 'https://store.steampowered.com/app/1091500/'),
  (2, NULL, 'Microsoft Studios', 'Mojang', 'Action & adventure, Family & kids', NULL, 'https://www.xbox.com/en-us/games/store/minecraft/9mvxmvt8zkwc'),
  (3, 'Feb 24, 2022', 'FromSoftware, Inc., Bandai Namco Entertainment', 'FromSoftware, Inc.', 'Action, RPG', 'English, French, Italian, German, Spanish - Spain, Japanese, Korean, Polish, Portuguese - Brazil, Russian, Simplified Chinese, Spanish - Latin America, Thai, Traditional Chinese, Arabic', 'https://store.steampowered.com/app/1245620/'),
  (4, 'Apr 13, 2015', 'Rockstar Games', 'Rockstar North', 'Action, Adventure', 'English, French, Italian, German, Spanish - Spain, Korean, Polish, Portuguese - Brazil, Russian, Traditional Chinese, Japanese, Simplified Chinese, Spanish - Latin America', 'https://store.steampowered.com/app/271590/'),
  (5, 'Dec 5, 2019', 'Rockstar Games', 'Rockstar Games', 'Action, Adventure', 'English, French, Italian, German, Spanish - Spain, Japanese, Korean, Polish, Russian, Simplified Chinese, Spanish - Latin America, Traditional Chinese, Portuguese - Brazil', 'https://store.steampowered.com/app/1174180/'),
  (6, 'Feb 10, 2023', 'Warner Bros. Games', 'Avalanche Software', 'Action, Adventure, RPG', 'English, French, Italian, German, Spanish - Spain, Arabic, Japanese, Korean, Polish, Portuguese - Brazil, Russian, Simplified Chinese, Spanish - Latin America, Traditional Chinese', 'https://store.steampowered.com/app/990080/'),
  (7, 'Nov 8, 2021', 'Xbox Game Studios', 'Playground Games', 'Action, Adventure, Racing, Simulation, Sports', 'English, French, Italian, German, Spanish - Spain, Czech, Hungarian, Japanese, Korean, Polish, Portuguese - Brazil, Russian, Simplified Chinese, Spanish - Latin America, Traditional Chinese, Turkish', 'https://store.steampowered.com/app/1551360/'),
  (8, 'Sep 26, 2024', 'Electronic Arts', 'EA Canada, EA Romania', 'Simulation, Sports', 'English, French, Italian, German, Spanish - Spain, Arabic, Czech, Danish, Dutch, Japanese, Korean, Norwegian, Polish, Portuguese - Brazil, Portuguese - Portugal, Russian, Simplified Chinese, Spanish - Latin America, Swedish, Traditional Chinese, Turkish', 'https://store.steampowered.com/app/2669320/'),
  (9, 'Aug 3, 2023', 'Larian Studios', 'Larian Studios', 'Adventure, RPG, Strategy', 'English, French, German, Spanish - Spain, Polish, Russian, Simplified Chinese, Turkish, Portuguese - Brazil, Italian, Spanish - Latin America, Traditional Chinese, Ukrainian, Korean, Japanese', 'https://store.steampowered.com/app/1086940/'),
  (10, 'May 18, 2015', 'CD PROJEKT RED', 'CD PROJEKT RED', 'RPG', 'English, French, Italian, German, Spanish - Spain, Arabic, Czech, Hungarian, Japanese, Korean, Polish, Portuguese - Brazil, Russian, Traditional Chinese, Turkish, Simplified Chinese, Spanish - Latin America, Ukrainian', 'https://store.steampowered.com/app/292030/'),
  (11, 'Feb 8, 2024', 'PlayStation Publishing LLC', 'Arrowhead Game Studios', 'Action', 'English, French, Italian, German, Spanish - Spain, Japanese, Korean, Portuguese - Brazil, Spanish - Latin America, Polish, Portuguese - Portugal, Russian, Simplified Chinese, Traditional Chinese', 'https://store.steampowered.com/app/553850/'),
  (12, 'Mar 23, 2023', 'CAPCOM Co., Ltd.', 'CAPCOM Co., Ltd.', 'Action, Adventure', 'English, French, Italian, German, Spanish - Spain, Arabic, Japanese, Korean, Portuguese - Brazil, Russian, Simplified Chinese, Traditional Chinese, Spanish - Latin America, Polish', 'https://store.steampowered.com/app/2050650/')
ON DUPLICATE KEY UPDATE
  release_date = VALUES(release_date),
  publisher = VALUES(publisher),
  developer = VALUES(developer),
  genres = VALUES(genres),
  languages = VALUES(languages),
  source_url = VALUES(source_url);

INSERT INTO product_description_sections (product_id, heading, body, sort_order) VALUES
  (1, 'Story', 'Play as V, a mercenary in Night City whose search for a way forward becomes tied to a powerful piece of experimental technology. The story follows V through alliances, jobs, and decisions in a city shaped by corporate power.', 1),
  (1, 'Gameplay', 'This first-person role-playing adventure combines firearms, close combat, stealth, hacking, and dialogue choices. Character attributes and equipment let players shape V toward different approaches.', 2),
  (1, 'World', 'Night City is a dense future metropolis divided into distinct districts, each with its own streets, people, and opportunities. Exploration connects main story missions with side jobs and encounters.', 3),
  (1, 'Key features', 'Build a character, take on contracts, and make choices that affect relationships and story outcomes. The Steam listing describes an open-world action-adventure RPG set in Night City.', 4),
  (2, 'Story', 'Minecraft is an open-ended sandbox rather than a fixed story campaign. Players create their own goals while exploring, gathering resources, and building in a world made of blocks.', 1),
  (2, 'Gameplay', 'Mine materials, craft tools, build structures, and survive environmental threats. Creative and survival play offer different ways to approach the same block-based sandbox.', 2),
  (2, 'World', 'Explore procedurally generated landscapes and underground spaces, with biomes and resources to discover. The world can be reshaped by collecting and placing blocks.', 3),
  (2, 'Key features', 'Building, exploration, crafting, and survival are the core activities. The Xbox Store lists Minecraft under Action & adventure and Family & kids, and identifies Xbox Series X|S optimization.', 4),
  (3, 'Story', 'The player takes the role of a Tarnished, journeying through the Lands Between and pursuing the title of Elden Lord. The world and its history are revealed through exploration, characters, and encounters.', 1),
  (3, 'Gameplay', 'This action role-playing game centers on real-time combat, weapon and magic choices, character progression, and difficult enemy encounters. Players can explore routes and approach many challenges in different ways.', 2),
  (3, 'World', 'The Lands Between is a large fantasy setting with open fields, ruins, dungeons, and legacy areas. Exploration links these regions and uncovers optional paths and discoveries.', 3),
  (3, 'Key features', 'Build a character, discover equipment, and challenge bosses across a connected open world. The official store listing identifies it as an action RPG developed by FromSoftware.', 4),
  (4, 'Story', 'Three protagonists—a street hustler, a retired bank robber, and a volatile criminal—become entangled in dangerous jobs and the Los Santos underworld. Their stories intersect as they try to survive a city where trust is scarce.', 1),
  (4, 'Gameplay', 'Switch between the three protagonists while completing missions, driving, and taking part in heists. The PC listing also includes Grand Theft Auto Online and a first-person view option.', 2),
  (4, 'World', 'Explore Los Santos and Blaine County, an open-world setting with urban neighborhoods and surrounding countryside. Story missions and optional activities take place across the map.', 3),
  (4, 'Key features', 'The Steam listing highlights a single-player story, online play, first-person mode, and the Rockstar Editor on PC. Available versions and regions in this marketplace are shown in the seller offers below.', 4),
  (5, 'Story', 'Arthur Morgan and the Van der Linde gang are outlaws on the run as federal agents and bounty hunters close in. The story follows the gang across the American heartland as they try to survive.', 1),
  (5, 'Gameplay', 'Ride, travel, and take on missions in a third-person action-adventure. The game combines gunfights, exploration, character interactions, and activities across its open world.', 2),
  (5, 'World', 'Set in 1899, the game moves through towns, wilderness, and varied landscapes in the American heartland. Travel and encounters connect the gang''s story with the wider world.', 3),
  (5, 'Key features', 'Follow Arthur and the gang through a story-led open-world adventure, with optional exploration and side activities. This summary describes the game itself; seller offers may differ by platform and region.', 4),
  (6, 'Story', 'Set in the 1800s, Hogwarts Legacy follows a student who enters the wizarding world and uncovers an old secret. The player character’s journey unfolds through school life, allies, and threats beyond the castle.', 1),
  (6, 'Gameplay', 'This open-world action RPG combines spell-based combat, exploration, quests, and character progression. Players learn magic and use it to solve challenges and face opponents.', 2),
  (6, 'World', 'Explore Hogwarts and locations in the surrounding wizarding world, including villages and wilderness. The setting is presented in an earlier period than the familiar Harry Potter stories.', 3),
  (6, 'Key features', 'Create a student character, learn spells, and take on quests across an explorable wizarding setting. The official store listing describes it as an open-world action RPG.', 4),
  (7, 'Story', 'Forza Horizon 5 is built around the Horizon Festival rather than a fixed narrative campaign. Players progress by taking part in events and exploring the festival’s setting.', 1),
  (7, 'Gameplay', 'Drive a wide range of cars through races, challenges, and open-world activities. Events and vehicle choices support different driving styles, from road racing to off-road routes.', 2),
  (7, 'World', 'The open world is a representation of Mexico, with varied landscapes and roads to explore. The official listing emphasizes the setting’s vibrant environments and free-driving possibilities.', 3),
  (7, 'Key features', 'Collect and drive cars, enter festival events, and explore the open world at your own pace. The title is listed in racing, simulation, sports, action, and adventure genres on Steam.', 4),
  (8, 'Story', 'EA SPORTS FC 25 focuses on club football rather than a single story campaign. Players build and manage teams and compete across the game’s football modes.', 1),
  (8, 'Gameplay', 'Play football matches, manage a club, and team up in the 5v5 Rush mode. FC IQ adds tactical controls for shaping how a team plays.', 2),
  (8, 'World', 'The game brings together club and international football settings through its licensed teams, players, and competitions. The available modes and teams depend on the specific game edition and updates.', 3),
  (8, 'Key features', 'The official store description highlights Rush, playing with friends, and FC IQ tactical control. It is categorized as simulation and sports on Steam.', 4),
  (9, 'Story', 'Baldur’s Gate 3 is a story-rich adventure in the Dungeons & Dragons universe. Choices shape a tale involving fellowship, betrayal, survival, sacrifice, and the pursuit of power.', 1),
  (9, 'Gameplay', 'Build a party and play through turn-based encounters, exploration, dialogue, and quests. Character creation and decisions allow multiple approaches to situations.', 2),
  (9, 'World', 'Travel through a fantasy setting populated by factions, companions, and creatures from the Forgotten Realms. Locations and conversations reveal more of the unfolding story.', 3),
  (9, 'Key features', 'Create or customize a character, recruit companions, and make choices that influence the journey. The official listing identifies it as a party-based role-playing game.', 4),
  (10, 'Story', 'Geralt of Rivia is a monster slayer searching for Ciri, his adopted daughter, while war and danger spread across the Northern Kingdoms. The main quest is accompanied by character stories and side contracts.', 1),
  (10, 'Gameplay', 'Track and fight monsters, prepare with equipment and alchemy, and make choices in quests. Combat, exploration, and conversations are central to Geralt’s journey.', 2),
  (10, 'World', 'Explore a dark fantasy world that includes cities, villages, forests, and war-torn regions. The open-world map connects the main story with monster contracts and optional quests.', 3),
  (10, 'Key features', 'Play as Geralt, follow the search for Ciri, and take on contracts throughout the world. The Steam listing identifies the title as a role-playing game developed and published by CD PROJEKT RED.', 4),
  (11, 'Story', 'Helldivers are soldiers enlisted to defend Super Earth and spread its vision of freedom across a hostile galaxy. Missions place squads in the middle of an ongoing galactic conflict.', 1),
  (11, 'Gameplay', 'This cooperative third-person shooter is built around squad missions, weapons, and support stratagems. Players coordinate with teammates while dealing with threats and battlefield hazards.', 2),
  (11, 'World', 'Operations take place on hostile planets across the galaxy. The campaign’s shifting fronts frame the missions and objectives available to players.', 3),
  (11, 'Key features', 'Team up, complete objectives, and call in support during combat. The official Steam description presents the game as a fast-paced third-person shooter and identifies Arrowhead Game Studios as its developer.', 4),
  (12, 'Story', 'Six years after the Raccoon City disaster, Leon S. Kennedy is sent to find the president’s kidnapped daughter. His search leads him to a secluded European village where the locals behave strangely.', 1),
  (12, 'Gameplay', 'Resident Evil 4 blends third-person action with survival-horror resource management. Leon explores, fights, and solves obstacles while managing ammunition and equipment.', 2),
  (12, 'World', 'The mission begins in a remote European village and moves through surrounding locations tied to the rescue operation. Exploration and encounters reveal the danger behind the isolated community.', 3),
  (12, 'Key features', 'Play as Leon in a reimagined version of the survival-horror action game. The official store listing identifies CAPCOM as both developer and publisher.', 4)
ON DUPLICATE KEY UPDATE
  heading = VALUES(heading),
  body = VALUES(body);

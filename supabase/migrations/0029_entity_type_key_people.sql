-- Business map "Team & Key People": directors and technology leads join
-- employees and contractors as first-class entity types.
alter type public.entity_type add value if not exists 'director';
alter type public.entity_type add value if not exists 'tech_lead';

--
-- PostgreSQL database dump
--

\restrict lOt3HYFqHBMcAYDhKTWHee7AWdJ0vUS14d60558STFbjWnNvP7JWhbZ7qos85GF

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: last_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.last_reads (
    name text NOT NULL,
    last_message_id integer
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    name text NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_base64 text,
    image_mime text
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Data for Name: last_reads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.last_reads (name, last_message_id) FROM stdin;
さな	28
なおき	29
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, name, text, created_at, image_base64, image_mime) FROM stdin;
1	なおき	@りさ 坦々麺まだかな？	2025-10-13 03:40:21.506069+00	\N	\N
2	りさ	そうだね😜	2025-10-13 03:40:54.99111+00	\N	\N
3	りさ	そうだね😜	2025-10-13 03:41:06.136812+00	\N	\N
4	なおき	@りさ まさかのテンプレ？	2025-10-13 03:41:22.091818+00	\N	\N
5	なおき	@りさ 坦々麺美味しいかったね♥️	2025-10-13 04:23:27.005173+00	\N	\N
6	りさ	うん😜	2025-10-13 04:24:11.776564+00	\N	\N
7	なおき	まさかの脈ナシ？😳	2025-10-13 04:24:37.227226+00	\N	\N
8	なおき	@さな はやくさなちゃんともやり取りしたいわ🥺	2025-10-13 04:25:03.945544+00	\N	\N
9	りさ	@なおき どこ行くー？	2025-10-13 04:26:26.438247+00	\N	\N
10	なおき	@りさ 拭き残しチェック中	2025-10-13 05:19:19.109423+00	\N	\N
11	りと	ただいまぁー😊	2025-10-13 09:03:06.44428+00	\N	\N
12	さな	ただいまぁー🏠	2025-10-13 09:03:19.528628+00	\N	\N
13	なおき	おかえりー😆	2025-10-13 09:03:31.509031+00	\N	\N
14	さな	今日は何しようかな？🤔	2025-10-13 09:12:49.792562+00	\N	\N
15	なおき	@さな チャットできそう？	2025-10-13 09:17:30.540844+00	\N	\N
16	さな	難しいかも...	2025-10-13 10:41:14.120016+00	\N	\N
17	さな	あああ	2025-10-13 10:44:42.21974+00	\N	\N
18	さな	@りさ いまからいくね!	2025-10-13 10:47:00.310047+00	\N	\N
19	なおき	いいね❤️	2025-10-13 10:48:10.091274+00	\N	\N
21	なおき	写真がアップロードできるようになったよ！	2025-10-13 11:19:40.584362+00	\N	\N
23	なおき	[かけざん れんしゅう]\nhttps://tsurutaro001.github.io/kuku-trainer/	2025-10-13 15:32:56.517473+00	\N	\N
20	guest		2025-10-13 11:18:57.561137+00	\N	\N
22	なおき		2025-10-13 11:20:26.677011+00	\N	\N
24	さな	今からピアノレッスンいくね！💕	2025-10-20 08:57:48.539942+00	\N	\N
25	なおき	@さな いつも頑張ってえらいね👏✨️	2025-10-21 09:11:44.224088+00	\N	\N
26	なおき	@さな ちゃん、優しいメッセージありがとう❤️	2025-10-22 14:22:52.178122+00	\N	\N
27	なおき	心が暖かくなったよ🥹✨️	2025-10-22 14:23:05.734191+00	\N	\N
28	さな	よーし!はじめてタブレットではいれた!😆パパできるだけ早く帰えってきてね!	2025-10-27 12:15:01.494117+00	\N	\N
29	なおき	@さな ちゃん、すごいね！タブレットから送信できたんだね👏仕事から帰ってきたときに、紗梛ちゃんと莉澄くんに会えて嬉しかったよ😆	2025-10-27 15:40:06.320205+00	\N	\N
\.


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 29, true);


--
-- Name: last_reads last_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_reads
    ADD CONSTRAINT last_reads_pkey PRIMARY KEY (name);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: last_reads last_reads_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.last_reads
    ADD CONSTRAINT last_reads_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict lOt3HYFqHBMcAYDhKTWHee7AWdJ0vUS14d60558STFbjWnNvP7JWhbZ7qos85GF


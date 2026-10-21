import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'htmlparser2';
import {findAll,findOne,textContent} from 'domutils';
const doc=parseDocument(readFileSync(`migration/cache/${createHash('sha256').update('/announcements/').digest('hex')}.html`,'utf8'));
const authors={};
for(const heading of findAll(n=>n.name==='h4',doc.children)) {
  const link=findOne(n=>n.name==='a'&&n.attribs?.href?.startsWith('/announcements/'),heading.children);
  const author=findOne(n=>n.name==='a'&&n.attribs?.href?.startsWith('/members/'),heading.parent.children);
  if(link&&author)authors[decodeURI(link.attribs.href)]={path:author.attribs.href,name:textContent(author).trim()};
}
const aliases=JSON.parse(readFileSync('migration/aliases.json','utf8'));
Object.assign(aliases,{'/members/pei-hsuan-lin/':'/members/114-hsuan/','/members/yu-hsiang-lin/':'/members/114-spig/','/members/yen-jung-chen/':'/members/112-conashin/','/members/yan-ting-liu/':'/members/9112-yann/'});
writeFileSync('migration/aliases.json',JSON.stringify(aliases,null,2)+'\n');
for(const filename of readdirSync('src/content/posts')) {
 const path='src/content/posts/'+filename,post=JSON.parse(readFileSync(path,'utf8'));
 const author=authors[`/announcements/${post.slug}/`];post.author=author?aliases[author.path]||author.path:null;post.authorName=author?.name||'';
 post.title=post.title.replace('⚠️','');
 post.tags=post.tags.map(tag=>tag==='Wi fi'?'Wi-Fi':tag);
 // Replace the original theme's table of contents with the new article navigation.
 post.body=post.body.replace(/<details\b[^>]*class="table-of-content[^>]*>[\s\S]*?<\/details>/,'').trim();
 writeFileSync(path,JSON.stringify(post,null,2)+'\n');
}
